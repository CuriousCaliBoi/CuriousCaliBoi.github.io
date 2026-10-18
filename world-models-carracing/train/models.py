"""The V and M models from "World Models" (Ha & Schmidhuber, 2018) in PyTorch.

Architectures and losses follow the paper's CarRacing code: a ConvVAE with a
32-dim latent and an MDN-RNN with 256 LSTM units and 5 Gaussian mixtures per
latent dimension.
"""

import math

import torch
import torch.nn.functional as F
from torch import nn

from common import ACTION_SIZE, NUM_MIXTURES, RNN_SIZE, Z_SIZE

LOG_SQRT_2PI = math.log(math.sqrt(2.0 * math.pi))
DECODER_INPUT_CHANNELS = 1024


class ConvVAE(nn.Module):
    """V: 64x64x3 frames <-> 32-dim Gaussian latent."""

    def __init__(self, z_size: int = Z_SIZE):
        super().__init__()
        self.z_size = z_size
        self.encoder = nn.Sequential(
            nn.Conv2d(3, 32, 4, stride=2),
            nn.ReLU(),
            nn.Conv2d(32, 64, 4, stride=2),
            nn.ReLU(),
            nn.Conv2d(64, 128, 4, stride=2),
            nn.ReLU(),
            nn.Conv2d(128, 256, 4, stride=2),
            nn.ReLU(),
        )
        self.fc_mu = nn.Linear(2 * 2 * 256, z_size)
        self.fc_logvar = nn.Linear(2 * 2 * 256, z_size)
        self.decoder_fc = nn.Linear(z_size, DECODER_INPUT_CHANNELS)
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(DECODER_INPUT_CHANNELS, 128, 5, stride=2),
            nn.ReLU(),
            nn.ConvTranspose2d(128, 64, 5, stride=2),
            nn.ReLU(),
            nn.ConvTranspose2d(64, 32, 6, stride=2),
            nn.ReLU(),
            nn.ConvTranspose2d(32, 3, 6, stride=2),
            nn.Sigmoid(),
        )

    def encode(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        hidden = self.encoder(x).flatten(1)
        return self.fc_mu(hidden), self.fc_logvar(hidden)

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        hidden = self.decoder_fc(z).view(-1, DECODER_INPUT_CHANNELS, 1, 1)
        return self.decoder(hidden)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        mu, logvar = self.encode(x)
        z = mu + torch.exp(0.5 * logvar) * torch.randn_like(mu)
        return self.decode(z), mu, logvar


def vae_loss(
    x: torch.Tensor, reconstruction: torch.Tensor, mu: torch.Tensor, logvar: torch.Tensor, kl_tolerance: float = 0.5
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Sum-of-squares reconstruction plus KL with the paper's free-bits floor (kl_tolerance * z_size)."""
    reconstruction_loss = ((x - reconstruction) ** 2).sum(dim=(1, 2, 3)).mean()
    kl = -0.5 * (1.0 + logvar - mu**2 - torch.exp(logvar)).sum(dim=1)
    kl_loss = torch.clamp(kl, min=kl_tolerance * mu.shape[1]).mean()
    return reconstruction_loss + kl_loss, reconstruction_loss, kl_loss


class MDNRNN(nn.Module):
    """M: LSTM over (z_t, a_t) emitting a mixture of Gaussians for each dimension of z_{t+1}."""

    def __init__(
        self,
        z_size: int = Z_SIZE,
        action_size: int = ACTION_SIZE,
        hidden_size: int = RNN_SIZE,
        num_mixtures: int = NUM_MIXTURES,
    ):
        super().__init__()
        self.z_size = z_size
        self.action_size = action_size
        self.hidden_size = hidden_size
        self.num_mixtures = num_mixtures
        self.lstm = nn.LSTM(z_size + action_size, hidden_size, batch_first=True)
        self.head = nn.Linear(hidden_size, z_size * num_mixtures * 3)
        # TensorFlow's BasicLSTMCell starts with a forget-gate bias of 1.0.
        with torch.no_grad():
            self.lstm.bias_ih_l0[hidden_size : 2 * hidden_size].fill_(1.0)
            self.lstm.bias_hh_l0[hidden_size : 2 * hidden_size].zero_()

    def mixture_params(self, hidden: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        params = self.head(hidden).view(*hidden.shape[:-1], self.z_size, self.num_mixtures, 3)
        return params[..., 0], params[..., 1], params[..., 2]  # logmix, mean, logstd

    def forward(
        self, z: torch.Tensor, action: torch.Tensor, state: tuple[torch.Tensor, torch.Tensor] | None = None
    ) -> tuple[tuple[torch.Tensor, torch.Tensor, torch.Tensor], tuple[torch.Tensor, torch.Tensor]]:
        output, state = self.lstm(torch.cat([z, action], dim=-1), state)
        return self.mixture_params(output), state


def mdn_loss(
    logmix: torch.Tensor,
    mean: torch.Tensor,
    logstd: torch.Tensor,
    target: torch.Tensor,
    mask: torch.Tensor | None = None,
) -> torch.Tensor:
    """Negative log-likelihood of target z under the per-dimension mixtures, averaged over valid steps."""
    target = target.unsqueeze(-1)
    log_weights = F.log_softmax(logmix, dim=-1)
    log_normal = -0.5 * ((target - mean) / torch.exp(logstd)) ** 2 - logstd - LOG_SQRT_2PI
    nll = -torch.logsumexp(log_weights + log_normal, dim=-1).mean(dim=-1)  # (batch, time)
    if mask is None:
        return nll.mean()
    return (nll * mask).sum() / mask.sum()


def sample_mixture(
    logmix: torch.Tensor, mean: torch.Tensor, logstd: torch.Tensor, temperature: float
) -> torch.Tensor:
    """Sample z_{t+1} with the paper's temperature: softened mixture weights and sqrt(tau)-scaled noise."""
    flat_logits = (logmix / temperature).reshape(-1, logmix.shape[-1])
    component = torch.multinomial(torch.softmax(flat_logits, dim=-1), 1).view(*logmix.shape[:-1], 1)
    chosen_mean = torch.gather(mean, -1, component).squeeze(-1)
    chosen_logstd = torch.gather(logstd, -1, component).squeeze(-1)
    return chosen_mean + torch.exp(chosen_logstd) * torch.randn_like(chosen_mean) * math.sqrt(temperature)


class MDNRNNCell(nn.Module):
    """One explicit LSTM step with the MDN head, written with plain matmuls so it exports to ONNX cleanly."""

    def __init__(self, rnn: MDNRNN):
        super().__init__()
        self.hidden_size = rnn.hidden_size
        self.z_size = rnn.z_size
        self.num_mixtures = rnn.num_mixtures
        self.weight_ih = nn.Parameter(rnn.lstm.weight_ih_l0.detach().clone())
        self.weight_hh = nn.Parameter(rnn.lstm.weight_hh_l0.detach().clone())
        self.bias = nn.Parameter((rnn.lstm.bias_ih_l0 + rnn.lstm.bias_hh_l0).detach().clone())
        self.head_weight = nn.Parameter(rnn.head.weight.detach().clone())
        self.head_bias = nn.Parameter(rnn.head.bias.detach().clone())

    def forward(
        self, z: torch.Tensor, action: torch.Tensor, h: torch.Tensor, c: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        x = torch.cat([z, action], dim=-1)
        gates = x @ self.weight_ih.t() + h @ self.weight_hh.t() + self.bias
        input_gate, forget_gate, cell_candidate, output_gate = gates.chunk(4, dim=-1)
        c_next = torch.sigmoid(forget_gate) * c + torch.sigmoid(input_gate) * torch.tanh(cell_candidate)
        h_next = torch.sigmoid(output_gate) * torch.tanh(c_next)
        params = (h_next @ self.head_weight.t() + self.head_bias).view(-1, self.z_size, self.num_mixtures, 3)
        return params[..., 0], params[..., 1], params[..., 2], h_next, c_next
