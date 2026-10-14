# Asset license manifest audit

Run the engine's `pnpm audit:assets path/to/licenses.json` before using a corpus. This offline tool checks
asset and evidence SHA-256 hashes and compares **declared** license and usage with the repository's
[content policy](https://github.com/pasquelin/Trillion3D/blob/develop/docs/COMPILER.md#content-licenses--independent-of-format). It does not fetch assets,
follow source URLs, send documents, infer a license from a marketplace, or certify legal compliance.
Authenticity, contract interpretation and whether a document actually grants a claimed right remain
human review responsibilities. A hash proves which document was supplied, not what it permits.

## Manifest version 1

Place the manifest at the common root of its assets and local evidence. Paths must stay inside
that root, including through symlinks. Asset IDs and paths must be unique. No assets or evidence
are copied into the repository by this tool; keep purchases and private documents off git.

```json
{
  "version": 1,
  "assets": [
    {
      "id": "tree",
      "path": "assets/tree.glb",
      "sha256": "<64 lowercase hexadecimal characters>",
      "source": "https://example.org/original-listing-or-source-revision",
      "license": "fab-standard",
      "licenseVersion": "exact terms edition from the acquisition record",
      "usage": "embedded-product",
      "evidence": {
        "terms": { "path": "evidence/terms.txt", "sha256": "<sha256>" },
        "acquisition": { "path": "evidence/acquisition.txt", "sha256": "<sha256>" }
      }
    }
  ]
}
```

The example placeholders must be replaced with actual hashes. `terms` identifies the actual
license or ownership evidence; `acquisition` links the asset/source to that license edition or
records original authorship. Retain historical purchase terms; a current listing is not proof
of the license under which an earlier asset was acquired. Unknown license IDs remain unresolved.

| Declaration | Documented checks |
| --- | --- |
| `fab-standard`, `unity-asset-store` | Internal/embedded-product use only; reject standalone redistribution |
| `quixel-epic-engine` | Reject use in Trillion3D |
| `cc-by` | Require `attribution` and `changes` evidence (state explicitly if unchanged) |
| `owned` | Require ownership and authorship evidence, through `terms` and `acquisition` |
| Any other license | Human review required; no inferred commercial allowlist |

`usage` is `internal`, `embedded-product`, `public-demo`, or `raw-distribution`. `public-demo`
means publishing the underlying assets in a demo or public repository, not merely showing pixels
of a finished product; both it and `raw-distribution` require `redistribution` evidence. The tool
checks the presence/integrity of that document, not its legal meaning. A special negotiated license
must use its own license ID and remain under review rather than override a standard-license rule.

## Results and exit status

JSON output separates `technical` integrity findings, `policy` contradictions and `review`
requirements. An empty manifest, malformed declaration or unreadable manifest exits **2**.
A documented prohibition produces `rejected`; an unknown license, missing/corrupt evidence,
invalid source URL or changed asset produces `review-required`. Either exits **1**.
Only all `matches-documented-criteria` results exit **0**; this means the declared criteria and
local hashes matched, never that copyright ownership or legal compliance was established.

The manifest version governs parsing. The report identifies the documented policy being used;
keep the report with the reviewed source revision and re-audit after policy or evidence changes.

## Licence table of every asset

One row per asset this repository tracks, or fetches from its own release, and the site uses.
"Declared licence" is what the official source states, read on 2026-10-05 through the page named in the cell. Nothing here certifies legal
compliance (see the top of this file). The models the engine's bench fetches and its test fixtures
live in the engine repository, which documents them; the site holds none of them.

| Asset | Origin | Declared licence (official source read) | Where it is in git | Attribution required | Where it is written | Use |
| --- | --- | --- | --- | --- | --- | --- |
| Marble Bust 01 (`marble-bust`) | [Poly Haven](https://polyhaven.com/a/marble_bust_01), Rico Cilliers | CC0 (page read) | Three copies: `site/assets/examples/models/marble-bust/` (as imported), `site/assets/examples/bust/source/`, `site/assets/examples/marble-bust/source/` | No (credited anyway) | `site/assets/examples/CREDITS.md` | Examples (`a-bust-a-crate-and-a-glass-ball`, `marble-bust-on-its-pedestal`, `see-the-triangles`), the scene editor's starter |
| Street lamp (`lantern`), Crate (`crate`) | W. Sitters, from [Elements-3D](https://github.com/pasquelin/Elements-3D) (a repository of the owner, redistributing them); Elements-3D page not read | CC BY 3.0 or GPL v2+ as stated in `CREDITS.md`; used under CC BY 3.0; licence text kept in `CC_attribution_licence.txt` (not re-read here) | `site/assets/examples/models/{lantern,crate}/` (as imported); the scenes built from them, `site/assets/examples/{street-corner,crates}/source/` | Yes | Each folder's `CC_attribution_licence.txt` and `Readme.txt`; `CREDITS.md`; example pages | Examples (`street-lamp-at-night`, `a-folder-merged-into-one-scene`, `crates-under-a-spotlight`, `a-bust-a-crate-and-a-glass-ball`), the scene editor's starter |
| CesiumMan | Khronos [`Models/CesiumMan`](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan) | © 2017 Cesium, CC BY 4.0; the Cesium logo has a [separate notice](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/LICENSES/LicenseRef-LegalMark-Cesium.txt) | `site/assets/examples/cesium-man/source/CesiumMan.glb`, unchanged | Yes | `site/assets/examples/CREDITS.md` | Examples (`a-character-that-walks`, `a-crowd-of-characters`, `additive-poses`) |
| AnimatedMorphCube | Khronos [`Models/AnimatedMorphCube`](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/AnimatedMorphCube) | © 2017 Public, CC0 1.0 | `site/assets/examples/animated-morph-cube/source/AnimatedMorphCube.glb`, unchanged | No | `site/assets/examples/CREDITS.md` | Example (`a-shape-that-morphs`) |
| NVIDIA Emerald Square, Day (`emerald-square`) | [NVIDIA ORCA](https://developer.nvidia.com/orca/nvidia-emerald-square), Nicholas Hull, Kate Anderson, Nir Benty; foliage by SpeedTree; converted to glTF with Blender 5.2.1 | © 2017 NVIDIA Corporation, CC BY-NC-SA 3.0 (the archive's `LICENSE.txt`, kept beside the file in the release) | Not in git: `emerald-day.glb` of the release `scenes-orca-1`, its sha256 in `scripts/site-caches.ts`; only its compiled cache is published | Yes (and non-commercial, share-alike) | `site/assets/examples/CREDITS.md`; the example page | Example (`a-walk-across-emerald-square`) |
| Scenes modelled in code (11 example scenes) | Writers in `scripts/docs/examples/` | CC0 | `site/assets/examples/*/source/`, the folders `CREDITS.md` lists | No | `site/assets/examples/CREDITS.md` | Examples |
| `hall` | Committed as is, written by no script (`COMMITTED_SOURCES`, `scripts/site-caches.ts`) | Repository `LICENSE` (PolyForm Noncommercial 1.0.0), as its glTF `asset.copyright` states: "Original Trillion3D contributors; repository license" | `site/assets/examples/hall/source/` | No | Its `geometry.gltf` (`asset.copyright`) | Examples (`lights-from-the-scene-file`, `page-materials`, `a-walker-among-balls`), the scene editor's starter |
| Observatory (`signature-architecture`) | `scripts/docs/observatory/` | Repository `LICENSE`, as its glTF `asset.copyright` states (same words) | `site/assets/gallery/signature-architecture/`, with its `preview.png` | No | Its `source/geometry.gltf` (`asset.copyright`) | Examples (`observatory-streamed`, `memory-on-a-budget`, `health-check`) |
| Example thumbnails | Captured from the site's own example pages (`scripts/docs/examples-thumbnails.ts`) | Repository `LICENSE`; each shows only the assets of its example, above | `site/assets/examples/thumbnails/` | As the example's assets | This table | Gallery, home, menus |
