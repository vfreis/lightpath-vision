# Skill — Premium Motion UI

Use this skill for visual interaction and animation in Braciera Vision.

## Direction

Premium, warm, cinematic and restrained. Use the La Braciera universe of fire/oven/craft as atmosphere, not as a gimmick.

## Preferred tools

Motion for React (`motion/react`): `motion`, `AnimatePresence`, `layout`, `layoutId`, springs, `MotionConfig`, `useReducedMotion`.

## Rules

1. Use transform/opacity as the default animation properties.
2. Shared photo continuity is a signature interaction: capture/preview -> analyzing -> result should reuse `layoutId` where practical.
3. Normal transitions: 180–450 ms. Hero moments can be longer but must not block interaction.
4. Scan-line/heat-glow effects are decorative; never imply a false processing result.
5. Ingredient/result elements can use short stagger.
6. Avoid heavy parallax, autoplay video, WebGL and particle systems that hurt mobile performance in the MVP.
7. Respect reduced motion globally (`MotionConfig reducedMotion="user"`) and use `useReducedMotion` for custom behavior.
8. Test on a mid-range Android device, not only desktop.
9. Animation must make state changes clearer; remove any animation that adds latency or visual noise.

## Signature sequence

Photo capture -> small shutter flash -> photo settles into preview -> confirm -> same image morphs into analysis card -> subtle scan line + stage text -> result name springs in -> quality indicators and ingredients stagger -> official reference opens with shared-element transition.
