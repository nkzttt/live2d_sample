/**
 * PIXI DOCS: https://pixijs.download/v4.8.9/docs/index.html
 * PIXI EXAMPLES: https://pixijs.io/examples-v4/#/
 */
import * as PIXI from "pixi.js";
import { ModelBuilder } from "./model";

const loadResources = <Name extends string>(
  resources: {
    name: Name;
    path: string;
    option?: PIXI.loaders.LoaderOptions;
  }[]
) => {
  const loader = PIXI.loaders.shared;
  resources.forEach(({ name, path, option }) => {
    loader.add(name, path, option);
  });
  return new Promise<{ [key in Name]: PIXI.loaders.Resource }>(
    (resolve, reject) => {
      loader
        .load((loader, resources) => resolve(resources))
        .onError.add(reject);
    }
  );
};

const onLoad = (
  resources: { [key in "moc" | "texture" | "motion"]: PIXI.loaders.Resource },
  container: Element
) => {
  const { clientWidth: width, clientHeight: height } = container;
  const app = new PIXI.Application(width, height, {
    transparent: true,
  });
  container.appendChild(app.view);

  const model = new ModelBuilder({
    mocBuffer: resources.moc.data,
    texture: resources.texture.texture,
  }).build();
  app.stage.addChild(model);
  model.position.set(width / 2, height / 2);
  model.scale.set(width, height);
  app.stage.addChild(model.masks);
  model.masks.resize(width, height);

  model.addAnimation(0, resources.motion.data);
  model.playAnimation(0);

  app.ticker.add((deltaTime) => {
    model.update(deltaTime);
    model.masks.update(app.renderer);
  });
};

export const setup = (
  mocPath: string,
  texturePath: string,
  motionPath: string
) => {
  const container = document.querySelector("#l2d");
  if (!container) return;

  loadResources([
    {
      name: "moc",
      path: mocPath,
      option: { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER },
    },
    {
      name: "texture",
      path: texturePath,
    },
    {
      name: "motion",
      path: motionPath,
      option: { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON },
    },
  ])
    .then((resources) => onLoad(resources, container))
    .catch((e: Error) => {
      console.error(e);
    });
};
