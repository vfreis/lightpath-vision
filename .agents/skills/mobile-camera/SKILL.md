# Skill — Mobile Camera

Use this skill for camera, gallery and image-preprocessing work in Braciera Vision.

## Contract

1. Mobile first; test from 360 px wide.
2. Camera UX uses `navigator.mediaDevices.getUserMedia` over HTTPS and prefers `facingMode: "environment"`.
3. Gallery/upload is always available through `input type="file" accept="image/*"`.
4. Treat permission denied, missing camera, cancellation and network failure as explicit UI states.
5. Stop media tracks when leaving the camera screen.
6. Normalize orientation and downscale/compress before upload; do not send full-resolution phone images unnecessarily.
7. Camera and gallery must feed the exact same downstream analysis pipeline.
8. Do not store or log user images beyond what the current prototype explicitly needs.
9. Do not implement fake scan results if upload/API fails.

## Acceptance

- Chrome Android camera works.
- Safari iOS camera works.
- Gallery works on both.
- Retake and confirm are accessible with one hand.
- Result orientation is correct.
- Image preview does not leak object URLs indefinitely; revoke when appropriate.
