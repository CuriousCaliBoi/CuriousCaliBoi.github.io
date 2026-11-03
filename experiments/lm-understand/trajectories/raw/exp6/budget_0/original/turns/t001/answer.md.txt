```python
import numpy as np

# Hand-designed policy circuit. No training, game simulation, or network execution.
N = 81
H = 512
OFFSET = 128.0

params = {}
for k in range(1, 7):
    params[f"L{k}.W"] = np.zeros((243 if k == 1 else H, H), np.float32)
    params[f"L{k}.b"] = np.zeros(H, np.float32)
params["out.W"] = np.zeros((H, 82), np.float32)
params["out.b"] = np.zeros(82, np.float32)

def unit(channel, point):
    return channel * N + point

def point(r, c):
    return r * 9 + c

coords = [divmod(p, 9) for p in range(N)]
neighbors = []
diagonals = []
for r, c in coords:
    neighbors.append([
        point(r + dr, c + dc)
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1))
        if 0 <= r + dr < 9 and 0 <= c + dc < 9
    ])
    diagonals.append([
        point(r + dr, c + dc)
        for dr, dc in ((-1, -1), (-1, 1), (1, -1), (1, 1))
        if 0 <= r + dr < 9 and 0 <= c + dc < 9
    ])

# Density, friendly shape, and opponent approach kernels.
kernels = {
    (0, 1): (1.000, 0.550, -0.650),
    (1, 1): (0.750, 0.700,  0.100),
    (0, 2): (0.700, 0.750,  0.250),
    (1, 2): (0.420, 0.450,  0.120),
    (2, 2): (0.180, 0.120,  0.000),
    (0, 3): (0.200, 0.200,  0.030),
    (1, 3): (0.120, 0.120,  0.020),
    (2, 3): (0.050, 0.040,  0.000),
    (3, 3): (0.025, 0.015,  0.000),
    (0, 4): (0.055, 0.030,  0.000),
    (1, 4): (0.035, 0.020,  0.000),
    (2, 4): (0.015, 0.000,  0.000),
}

density = np.zeros((N, N), np.float32)
friendly_shape = np.zeros((N, N), np.float32)
enemy_shape = np.zeros((N, N), np.float32)

full_density_mass = 0.0
for dr in range(-4, 5):
    for dc in range(-4, 5):
        full_density_mass += kernels.get(
            tuple(sorted((abs(dr), abs(dc)))), (0.0, 0.0, 0.0)
        )[0]

for p, (r, c) in enumerate(coords):
    for q, (s, t) in enumerate(coords):
        d, f, e = kernels.get(
            tuple(sorted((abs(r - s), abs(c - t)))),
            (0.0, 0.0, 0.0),
        )
        density[p, q] = d
        friendly_shape[p, q] = f
        enemy_shape[p, q] = e
    factor = min(
        1.65,
        np.sqrt(full_density_mass / float(density[p].sum()))
    )
    density[p] *= factor

TOTAL, WHITE, OWN_COUNT, OPP_COUNT = 486, 487, 488, 489
PHASE, LATE, AHEAD, BEHIND = 490, 491, 492, 493

# L1: stones, direct liberties on stones, and territorial density penalties.
W, b = params["L1.W"], params["L1.b"]
for p in range(N):
    W[3*p, unit(0, p)] = 1.0
    W[3*p+1, unit(1, p)] = 1.0

    for color, channel in ((0, 2), (1, 3)):
        j = unit(channel, p)
        b[j] = len(neighbors[p]) - 4.0
        W[3*p+color, j] += 4.0
        for q in neighbors[p]:
            W[3*q, j] -= 1.0
            W[3*q+1, j] -= 1.0

    j_own, j_opp = unit(4, p), unit(5, p)
    b[j_own], b[j_opp] = -2.4, -2.1
    for q in range(N):
        d = density[p, q]
        if d:
            W[3*q, j_own] += d
            W[3*q+1, j_own] -= 0.7*d
            W[3*q+1, j_opp] += d
            W[3*q, j_opp] -= 0.7*d

    W[3*p, TOTAL] = 1.0
    W[3*p+1, TOTAL] = 1.0
    W[3*p+2, WHITE] = 1.0 / N
    W[3*p, OWN_COUNT] = 1.0
    W[3*p+1, OPP_COUNT] = 1.0

# L2: certified liberty evidence and strategic move scores.
#
# In a same-color star, an individual liberty contributes at most eight
# to the weighted liberty sum below. Thus sums >8 and >16 certify
# at least two and three DISTINCT liberties, respectively.
W, b = params["L2.W"], params["L2.b"]
line_prior = [-1.30, -0.05, 0.75, 0.65, 0.55,
               0.65, 0.75, -0.05, -1.30]

for p, (r, c) in enumerate(coords):
    W[unit(0, p), unit(0, p)] = 1.0
    W[unit(1, p), unit(1, p)] = 1.0

    # The orientation choice preserves rotations and reflections.
    if abs(r - 4) > abs(c - 4):
        vertical, horizontal = 3.0, 5.0
    elif abs(r - 4) < abs(c - 4):
        vertical, horizontal = 5.0, 3.0
    else:
        vertical = horizontal = 4.0

    for color, source_lib, destination, threshold in (
        (0, 2, 2, 8.0),
        (1, 3, 3, 8.0),
        (0, 2, 4, 16.0),
    ):
        j = unit(destination, p)
        b[j] = -threshold - 64.0
        W[unit(color, p), j] += 64.0
        W[unit(source_lib, p), j] += 8.0
        for q in neighbors[p]:
            s, t = coords[q]
            coefficient = vertical if s != r else horizontal
            W[unit(source_lib, q), j] += coefficient

    j = unit(5, p)
    positional = line_prior[r] + line_prior[c]
    if r in (2, 6) and c in (2, 6):
        positional += 0.35
    if (r, c) == (4, 4):
        positional += 0.15
    b[j] = OFFSET + positional

    W[unit(4, p), j] -= 2.4
    W[unit(5, p), j] -= 2.7
    for q in range(N):
        W[unit(0, q), j] += friendly_shape[p, q]
        W[unit(1, q), j] += enemy_shape[p, q]

for g in (TOTAL, WHITE, OWN_COUNT, OPP_COUNT):
    W[g, g] = 1.0
W[TOTAL, PHASE], b[PHASE] = 1.0, -18.0
W[TOTAL, LATE], b[LATE] = 1.0, -52.0
W[OWN_COUNT, AHEAD] = 1.0
W[OPP_COUNT, AHEAD] = -1.0
W[WHITE, AHEAD] = 7.5
b[AHEAD] = -1.0
W[OWN_COUNT, BEHIND] = -1.0
W[OPP_COUNT, BEHIND] = 1.0
W[WHITE, BEHIND] = -7.5
b[BEHIND] = 1.0

def copy_globals(W):
    for g in range(TOTAL, BEHIND + 1):
        W[g, g] = 1.0

# L3: propagate certified liberty evidence through same-color stones.
# A pair (z,g) encodes stone=z-g exactly and nonnegative evidence=g.
W, b = params["L3.W"], params["L3.b"]
M = 481.0
for p in range(N):
    neighborhood = [p] + neighbors[p]
    for stone_channel, evidence_channel, z_channel, g_channel in (
        (0, 2, 0, 1),
        (1, 3, 2, 3),
    ):
        for destination, subtraction in ((z_channel, 0.0), (g_channel, 1.0)):
            j = unit(destination, p)
            W[unit(stone_channel, p), j] += M + 1.0
            for q in neighborhood:
                W[unit(evidence_channel, q), j] += 1.0
            b[j] = -M - subtraction

    j = unit(4, p)
    W[unit(0, p), j] += M
    for q in neighborhood:
        W[unit(4, q), j] += 1.0
    b[j] = -M
    W[unit(5, p), unit(5, p)] = 1.0
copy_globals(W)

# L4: another same-color propagation step.
W, b = params["L4.W"], params["L4.b"]
M = 2401.0
for p in range(N):
    neighborhood = [p] + neighbors[p]
    for z_channel, g_channel in ((0, 1), (2, 3)):
        for destination, subtraction in ((z_channel, 0.0), (g_channel, 1.0)):
            j = unit(destination, p)
            W[unit(z_channel, p), j] += M + 1.0
            W[unit(g_channel, p), j] -= M + 1.0
            for q in neighborhood:
                W[unit(g_channel, q), j] += 1.0
            b[j] = -M - subtraction

    j = unit(4, p)
    W[unit(0, p), j] += M
    W[unit(1, p), j] -= M
    for q in neighborhood:
        W[unit(4, q), j] += 1.0
    b[j] = -M
    W[unit(5, p), unit(5, p)] = 1.0
copy_globals(W)

# L5: recover stones and bounded tactical classifications.
# "Unsafe" means no two-liberty certificate reached this stone.
# These flags deliberately err toward noticing threats.
W, b = params["L5.W"], params["L5.b"]
for p in range(N):
    neighborhood = [p] + neighbors[p]
    for z_channel, g_channel, stone_channel, unsafe_channel in (
        (0, 1, 0, 2),
        (2, 3, 1, 3),
    ):
        j = unit(stone_channel, p)
        W[unit(z_channel, p), j] += 1.0
        W[unit(g_channel, p), j] -= 1.0

        j = unit(unsafe_channel, p)
        W[unit(z_channel, p), j] += 1.0
        W[unit(g_channel, p), j] -= 1.0
        for q in neighborhood:
            W[unit(g_channel, q), j] -= 1.0

    j = unit(4, p)  # Friendly stone lacking a three-liberty certificate.
    W[unit(0, p), j] += 1.0
    W[unit(1, p), j] -= 1.0
    for q in neighborhood:
        W[unit(4, q), j] -= 1.0

    W[unit(5, p), unit(5, p)] = 1.0
copy_globals(W)

# L6: move-level capture/rescue, shape, eyes, self-atari, and safe contact.
W, b = params["L6.W"], params["L6.b"]
for p, (r, c) in enumerate(coords):
    degree = len(neighbors[p])

    for q in neighbors[p]:
        W[unit(2, q), unit(0, p)] += 1.0  # Rescue urgency.
        W[unit(3, q), unit(1, p)] += 1.0  # Capture urgency.

    j = unit(2, p)
    W[unit(5, p), j] = 1.0
    edge_phase_weight = 0.0
    for d in (min(r, 8-r), min(c, 8-c)):
        if d == 0:
            edge_phase_weight += 0.030
        elif d == 1:
            edge_phase_weight += 0.012
    W[PHASE, j] += edge_phase_weight
    for q in neighbors[p]:
        W[unit(1, q), j] += 1.1

    # True-eye preservation, with diagonal false-eye exceptions.
    j = unit(3, p)
    b[j] = 1.0 - degree
    for q in neighbors[p]:
        W[unit(0, q), j] += 1.0
    diagonal_penalty = 0.5 if degree == 4 else 1.0
    for q in diagonals[p]:
        W[unit(1, q), j] -= diagonal_penalty

    # Conservative self-atari / futile-extension penalty.
    # Capturing or connecting to a certified strong group exempts a move.
    j = unit(4, p)
    b[j] = 2.0 - 1.6 * degree
    for q in neighbors[p]:
        W[unit(0, q), j] += -3.2
        W[unit(1, q), j] += 1.6
        W[unit(2, q), j] += 1.4
        W[unit(3, q), j] -= 4.0
        W[unit(4, q), j] += 4.0

    # Enemy contact is rewarded primarily when backed by a strong group.
    j = unit(5, p)
    for q in neighbors[p]:
        W[unit(1, q), j] += 1.0
        W[unit(0, q), j] -= 2.0
        W[unit(4, q), j] += 2.0

copy_globals(W)

# Output policy.
W, b = params["out.W"], params["out.b"]
for p in range(N):
    b[p] = -OFFSET
    for channel, coefficient in (
        (0, 4.6),
        (1, 7.1),
        (2, 1.0),
        (3, -64.0),
        (4, -9.0),
        (5, -1.6),
    ):
        W[unit(channel, p), p] = coefficient

# Passing remains unlikely while constructive moves exist.
b[81] = -5.6
W[PHASE, 81] = 0.050
W[LATE, 81] = 0.045
W[AHEAD, 81] = 0.025
W[BEHIND, 81] = -0.035
W[WHITE, 81] = 0.150

# Only inspect and save weights; do not evaluate the policy.
for name, array in params.items():
    assert array.dtype == np.float32
    assert np.isfinite(array).all()
    save(name, array)

print("Saved all 14 tensors.")
print("Parameters:", sum(a.size for a in params.values()))
print("Nonzero parameters:", sum(np.count_nonzero(a) for a in params.values()))
print("Design: certified local liberty propagation, capture/rescue priorities,")
print("self-atari filtering, eye preservation, territorial shape, and late passing.")
```