# HoloPortrait

A clinician projected as a hologram: a light-form on a glowing projector base, inside a beam, with 3D orbit rings, scanlines, a slow sweep and a glass caption chip.

**The consumer provides** `name`, `role`, and optionally `status` with `statusLabel`, `size` (stage width in px, default 360) and `src`.

- Without `src` it draws the built-in light-form: a wireframe bust in a lab coat with a stethoscope, and no face.
- With `src`, pass a transparent-background portrait cut-out (PNG or WebP, shoulders up, eye-level, neutral expression). It is tinted cyan, screened onto the beam and given the same scanlines and sweep.

**Rules**
- One hologram per screen: it is the focal point. Arrange telemetry around it, never over the head.
- Only show a real clinician with their consent, and only a clinician. Never a patient.
- Give `alt` when the portrait says more than the name ("Dr. Noor Rahman, joining by video").
- Under `prefers-reduced-motion` the flicker, sweep and orbit stop; the figure stays.
