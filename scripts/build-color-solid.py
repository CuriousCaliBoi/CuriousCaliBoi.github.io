"""Rebuild the D65 surface-color boundary. Requires numpy and scipy.

The bounded spectral sum is a zonotope. Cross products of every pair of
generators give all possible facet normals, including multi-transition optima.
This avoids assuming that an optimal spectrum has only two transitions.
"""

import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import linprog
from scipy.spatial import ConvexHull, HalfspaceIntersection

ROOT = Path(__file__).resolve().parents[1] / "color-solid"
DATA = ROOT / "data"
CHECKSUMS = {
    "CIE_xyz_1931_2deg.csv": "17cca777db64b17170f06f67ce9d3ab7",
    "CIE_std_illum_D65.csv": "03d4eb9b837c60671627c946fb534deb",
}
for filename, expected in CHECKSUMS.items():
    assert hashlib.md5((DATA / filename).read_bytes()).hexdigest() == expected

cmf = np.loadtxt(DATA / "CIE_xyz_1931_2deg.csv", delimiter=",")
illuminant = np.loadtxt(DATA / "CIE_std_illum_D65.csv", delimiter=",")
energy = np.interp(cmf[:, 0], illuminant[:, 0], illuminant[:, 1])
weights = cmf[:, 1:] * energy[:, None]
weights /= weights[:, 1].sum()
white = weights.sum(axis=0)

# sRGB's specified D65 white differs very slightly from the 1 nm spectral sum.
# Match the reference whites before comparing the display and surface volumes.
srgb_white = np.array([.3127 / .3290, 1, (1 - .3127 - .3290) / .3290])
rgb_to_xyz = np.array([
    [.4123907992659595, .35758433938387796, .1804807884018343],
    [.21263900587151036, .7151686787677559, .07219231536073371],
    [.01933081871559185, .11919477979462599, .9505321522496607],
])
xyz_to_rgb = np.linalg.inv(rgb_to_xyz)


def inverse_f(t):
    t = np.asarray(t)
    return np.where(t > 6 / 29, t ** 3, 3 * (6 / 29) ** 2 * (t - 4 / 29))


def xyz(lightness, hue, chroma):
    angle = np.deg2rad(hue)
    fy = (lightness + 16) / 116
    return white * inverse_f([fy + chroma * np.cos(angle) / 500,
                              fy, fy - chroma * np.sin(angle) / 200])


def rgb(lightness, hue, chroma):
    return xyz_to_rgb @ (xyz(lightness, hue, chroma) * srgb_white / white)


def limit(predicate, upper=400):
    assert predicate(0) and not predicate(upper)
    low = 0
    for _ in range(40):
        middle = (low + upper) / 2
        if predicate(middle):
            low = middle
        else:
            upper = middle
    return low


directions = weights / np.linalg.norm(weights, axis=1)[:, None]
i, j = np.triu_indices(len(weights), 1)
normals = np.cross(directions[i], directions[j])
length = np.linalg.norm(normals, axis=1)
normals = normals[length > 1e-12] / length[length > 1e-12, None]
normals = np.concatenate([normals, -normals])
normals = np.unique(np.round(normals, 12), axis=0)
bounds = np.concatenate([
    np.maximum(0, batch @ weights.T).sum(axis=1)
    for batch in np.array_split(normals, 64)
])
print(f"{len(weights)} wavelengths; {len(normals)} supporting planes", flush=True)

rows = []
max_residual = 0
for lightness in range(5, 100, 5):
    y = float(inverse_f((lightness + 16) / 116))
    halfspaces = np.column_stack([normals[:, 0], normals[:, 2], normals[:, 1] * y - bounds])
    halfspaces = halfspaces[np.linalg.norm(halfspaces[:, :2], axis=1) > 1e-12]
    neutral = (white * y)[[0, 2]]
    vertices = HalfspaceIntersection(halfspaces, neutral).intersections
    planes = ConvexHull(vertices).equations
    for hue in range(0, 360, 10):
        def physical(chroma):
            xz = xyz(lightness, hue, chroma)[[0, 2]]
            return bool(np.all(planes[:, :2] @ xz + planes[:, 2] <= 1e-11))

        maximum = limit(physical)
        screen = limit(lambda c: bool(np.all(rgb(lightness, hue, c) >= -1e-12)
                                       and np.all(rgb(lightness, hue, c) <= 1 + 1e-12)))
        # Check that the radial lookup did not miss a disconnected feasible region.
        assert all(physical(c) for c in np.linspace(0, maximum * .999, 24))
        assert not any(physical(c) for c in np.linspace(maximum + .001, 400, 150))
        # Independent feasibility checks distinguish actual reflectances from a
        # merely plausible-looking envelope. An outward step must be infeasible.
        target = xyz(lightness, hue, maximum - 1e-5)
        fit = linprog(np.zeros(len(weights)), A_eq=weights.T, b_eq=target,
                      bounds=(0, 1), method="highs")
        assert fit.success, (lightness, hue, fit.message)
        max_residual = max(max_residual, float(np.max(np.abs(weights.T @ fit.x - target))))
        outside = linprog(np.zeros(len(weights)), A_eq=weights.T,
                          b_eq=xyz(lightness, hue, maximum + .05), bounds=(0, 1), method="highs")
        assert not outside.success, (lightness, hue, "outward point is feasible")
        rows.append([hue, lightness, round(maximum, 5), round(screen, 5)])
    print(f"L* {lightness:2}: verified 36 hue boundaries", flush=True)

payload = {
    "description": "Numerical object-color solid for nonfluorescent reflecting surfaces under D65, CIE 1931 2-degree observer.",
    "method": "All zonotope facet halfspaces from 471 wavelength generators; fixed-L* cross sections; CIELAB hue-ray intersections. No two-transition restriction.",
    "resolution": {"wavelengthNm": 1, "rangeNm": [360, 830], "lightnessStep": 5, "hueStepDegrees": 10},
    "whiteXYZ": white.tolist(),
    "columns": ["h_ab_degrees", "L_star", "surface_C_ab_max", "sRGB_C_ab_max"],
    "license": "CC BY-SA 4.0; derived from CIE 2019 datasets, with numerical transformations described above.",
    "sources": ["https://doi.org/10.25039/CIE.DS.xvudnb9b", "https://doi.org/10.25039/CIE.DS.hjfjmt59"],
    "validation": {"boundaryChecks": len(rows), "maxXYZReconstructionError": max_residual,
                   "outwardChromaStepRejected": .05},
    "boundaries": rows,
}
(ROOT / "surface-solid.json").write_text(json.dumps(payload, separators=(",", ":")) + "\n")
print(json.dumps(payload["validation"]), flush=True)
