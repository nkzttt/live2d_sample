import { setup } from "./modules/setup";

(async () => {
  const result = await setup();
  if (!result) return;

  const { model } = result;
  model.playAnimation("idle");

  document
    .querySelectorAll('[data-js-trigger="switchAnimation"]')
    .forEach((element) => {
      element.addEventListener("click", (e) => {
        if (!(e.target instanceof HTMLButtonElement)) return;
        const animationName = e.target.dataset.jsAttributes;
        if (!animationName) return;
        model.setNextAnimation(animationName);
      });
    });
})();
