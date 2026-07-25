# Visual Reference Audit

Sixteen references, studied for what is *transferable* rather than what is
impressive. The output is one art-directed world — not a collage of effects
lifted from sixteen sites.

**The finding that governs everything below**, established by reading the
technical case studies rather than assuming:

> The realism in the architectural references does not come from better
> real-time lighting. It comes from **light that was computed offline and baked
> into textures**. Shapespark precomputes global illumination. UNVUE streams
> Unreal from a cloud GPU. Neither is doing what a browser does live.

That reframes the whole problem. The gap between this project's render and
UNVUE is not effort or tuning — it is *technique and assets*. Chasing it with
more real-time lights is the loop to avoid.

---

## Part 1 — The three rendering levels, and which one this is

### Level 1 · Browser-native Three.js — **what this project is**
```
Blender → optimized GLB → baked GI → PBR materials → KTX2 textures
        → React Three Fiber → restrained post-processing
```
Reaches premium architectural-visualisation quality **and stays genuinely
interactive**, which matters more here than fidelity: backend events must be
able to drive objects, lighting and room state. A video cannot do that.

### Level 2 · Unreal + Pixel Streaming — **what UNVUE does**
Highest fidelity: Lumen, Nanite, path tracing, delivered over WebRTC. The
trade is real — cloud-GPU cost per concurrent session, streaming latency,
and it arrives as a *video stream*, which makes scroll-linked page behaviour
and DOM interleaving much harder. Correct as an optional "ultra mode" for a
private showcase; wrong as the only way the public experience works.

### Level 3 · Pre-rendered cinematic video
Most photorealistic, zero interactivity. Correct for exterior arrival,
day-to-dusk, seasonal passage. **Never** for anything a viewer could mistake
for working software.

**Decision: Level 1 as the spine, Level 3 for emotional transitions, Level 2
documented as a future option.** Rationale in ADR-005.

---

## Part 2 — Reference-by-reference

### A · Realistic architectural space

#### 1 · Shapespark Product Tour
| | |
|---|---|
| **Relevant quality** | Precomputed GI retaining architectural realism in a browser |
| **Adapt** | The baking principle; hotspot-based information placement; the discipline of a fixed camera height |
| **Do not copy** | Their tour UI, node-hopping navigation, branding |
| **Camera** | Waypoint teleport at ~1.6m — not free-fly. Orientation is preserved because the user never leaves human eye height |
| **Lighting** | Fully baked. Real-time lights are decorative only |
| **Navigation** | Discrete waypoints, not continuous walking |
| **UI** | Sparse hotspots anchored to objects |
| **Mobile** | Same scene, reduced texture resolution |
| **Accessibility** | Waypoint list is keyboard-reachable — worth stealing |
| **Performance** | Baked lighting means near-zero per-frame light cost |
| **Chapter** | All interior chapters |

#### 2 · Gratio Residence Penthouse
| | |
|---|---|
| **Relevant quality** | **Furniture density.** A premium interior is *full*. Sparse rooms read as CAD regardless of material quality |
| **Adapt** | Layering: rug → furniture → objects on surfaces → art → planting. Natural light as the primary source with practicals as accents |
| **Do not copy** | Their specific interior design or furniture selection |
| **Camera** | Composed like interior photography — one-point perspective down a room axis, verticals kept vertical |
| **Lighting** | Daylight-dominant with warm practicals for accent |
| **Chapter** | Living, kitchen, dining |
| **Gap here** | This project's rooms are under-furnished relative to this benchmark. Density is the cheapest realism available and does not need new technique |

#### 3 · House Penteli
| | |
|---|---|
| **Relevant quality** | Room-to-room *flow* and sustained orientation |
| **Adapt** | Never cut between rooms — travel through the opening, so the viewer always knows where they are. Frame the doorway before crossing it |
| **Camera** | Constant eye height; turns happen at thresholds, not mid-room |
| **Chapter** | Every transition |
| **Applied** | This audit's finding produced the utility-room doorway fix — the camera had been walking into a solid wall because the room had no way in |

#### 4 · Hillside ArchViz (Unreal/Vagon)
| | |
|---|---|
| **Relevant quality** | Exterior-to-interior continuity, cinematic camera, dusk transition |
| **Adapt** | The *choreography* — the arrival curve, the slow-down before the threshold |
| **Do not copy** | Expectation of Lumen-quality GI in a browser |
| **Performance** | Cloud GPU. Not a browser budget |
| **Chapter** | Arrival |

#### 5 · UNVUE Studio
| | |
|---|---|
| **Relevant quality** | Luxury-real-estate presentation: dusk exterior, warm interior glow through floor-to-ceiling glass, pool, landscape lighting |
| **Adapt** | **The composition.** Low camera, house at three-quarter view, interior warmth as the focal point against a cool exterior. That contrast is achievable at Level 1 and is most of the emotional effect |
| **Do not copy** | Their brand, copy, layout — and do not assume their fidelity is a browser render. It is streamed Unreal |
| **Lighting** | Dusk key + warm interior practicals. **This exact scheme is what the Living Home already uses** — the difference is baked GI and real materials, not light placement |
| **Chapter** | Arrival, and the visual target for the whole piece |

### B · Cinematic web storytelling

#### 6 · Noomo ValenTime
**Adapt** portal entry into a persistent world; one central object that evolves
rather than a sequence of unrelated scenes. **Chapter:** the Move Record as the
object that changes state through the whole film. **Do not copy** the portal
visual itself.

#### 7 · House of Dreamers
**Adapt** continuity between interface and scene — overlays that feel part of
the world rather than pasted over it. **Chapter:** every caption. **Mobile:**
their approach of a genuinely different composition, not a squeezed desktop.

#### 8 · 3D Model Home Gallery
**Adapt** overview-to-detail transitions and **cutaway views** — a floor plan
that opens to reveal a room is directly applicable to showing the Move Record
underneath the house. **Chapter:** foyer, and the engineering reveal.

#### 9 · Finely Crafted
| | |
|---|---|
| **Relevant quality** | Turning a real place into an explorable narrative where each area has a *narrative purpose* |
| **Adapt** | Information designed around physical objects; sound used sparingly; the visitor never disoriented |
| **Chapter** | The governing model for the whole experience — this is the closest reference to the intent |
| **Already applied** | Each room owns one service. The room does not illustrate the service; the room *is* the service |

#### 10 · Organimo
| | |
|---|---|
| **Relevant quality** | Product information layered into the scene without falling back to feature cards |
| **Adapt** | **Diegetic placement**: router information emerges near the router, electricity status as the lights activate, security at the entrance, warranty in the utility room, engineering evidence only when the house becomes transparent |
| **Do not copy** | The surreal visual language — wrong register for a trust product |
| **Chapter** | All. This is the rule for every caption |
| **Gap here** | Captions are currently a fixed lower-third card. Organimo-grade would anchor each one to its object in 3D space |

### C · Technical case studies — the actionable findings

#### 11 · Codrops · Scroll-driven 3D world
Concrete numbers worth holding to:
- **KTX2/Basis** because "standard PNGs and JPGs are brutal on GPU memory" and
  KTX2 decompresses **on the GPU**
- **GPU instancing** for repeated geometry — stated as "the difference between
  30 FPS and 144"
- **Draco**: GLTF exports "enormous before Draco… a fraction of the size with
  no visible quality loss"
- **Frustum culling over static LOD tiers**
- **Lower-resolution render targets for mobile shaders**, composited back
- GSAP `Observer` to unify mouse/touch/trackpad so the site feels like "a
  single camera take"

#### 12 · Codrops · Blender → Three.js
The most important document of the sixteen:
- **Bake Cycles GI to textures at 4096², then reduce.** Settings: Combined
  bake, Denoise (Compositor), Linear Rec.709
- **Disable renderer denoise before baking** or seams get black lines
- **Split bake sets by proximity and object type** — one massive texture kills
  performance
- **Join objects before baking to cut draw calls**; keep interactive meshes
  separate
- Blender focal length ↔ Three.js FOV: low focal length = high FOV
- Identify interactive objects **by mesh name** after export; R3F events attach
  directly, no separate hitboxes
- Delete geometry the camera can never see
- Chunked `Suspense` with `useProgress`; gate interactivity behind a ready flag
- **Too many concurrent loads triggers "WebGL: context lost" on iOS** — load
  in sequence, and set `touch-action: none`

#### 13–16 · R3F, ScrollTrigger, GLTFLoader, KTX2Loader
Already in use or documented as the migration path. ScrollTrigger's `Observer`
is a real upgrade over raw scroll listeners for unifying input.

---

## Part 3 — The original visual system

Not a combination. One set of rules, derived from the above and from Utility
Connect's own measured brand.

**Materials** — board-formed white concrete, limestone, warm oak, walnut,
brushed metal, floor-to-ceiling glazing with charcoal mullions. Light materials
in dim light read as architecture; dark materials read as murk.

**Light** — dusk key, warm practicals as accent, cool rim for separation.
Interior warmth against a cool exterior is the single strongest emotional
device available, and it is fully achievable at Level 1.

**Colour discipline** — the only saturated colour in frame is a service signal
doing a job: electricity warm gold, internet cool cyan, water blue, gas amber,
security violet, verified `#0087B5`, conflict amber, unknown held-amber,
recovered green. *A colour that does not name a utility state is a bug.*

**Camera** — human eye height, constant. Turn at thresholds, travel through
openings, never cut between rooms. Slow before information.

**Information** — diegetic wherever readability allows. Anchored to the object
it describes.

**Sound** — off by default, captioned if ever added.

---

## Part 4 — Honest gap analysis

What separates the current build from the architectural references, ranked by
how much each would close and whether it is reachable here:

| Gap | Impact | Reachable in this environment? |
|---|---|---|
| **Baked global illumination** | Largest by far | ✗ Needs Blender + offline bake |
| **Real PBR texture maps** (albedo/normal/roughness) | Very large | ✗ Needs asset files |
| **Modelled geometry** rather than primitives | Large | ✗ Needs modelling |
| **Furniture density** | Large | ✓ Pure placement work |
| **Tone mapping** (ACES) | Large for cost | ✓ **Applied this pass** |
| **Procedural texture detail** via canvas | Medium | ✓ Already proven with the siding maps |
| **Diegetic captions anchored in 3D** | Medium | ✓ Code only |
| **KTX2 / Draco / instancing** | Performance, not looks | ✓ When real assets exist |

**The honest conclusion:** three of the top four levers require an asset
pipeline that does not exist in this environment. Saying so is more useful
than another round of light tuning that cannot close a gap caused by
technique.

**The reachable list, in order:** tone mapping *(done)* → furniture density →
procedural material detail → diegetic captions. Beyond that, the path is
Blender: model, bake, export GLB, compress with Draco + KTX2, load through the
existing R3F scene. The chapter system, camera rig, and state bindings already
built would carry over unchanged — which is the point of having built them
that way.
