/**
 * PIXI DOCS: https://pixijs.download/v4.8.9/docs/index.html
 * PIXI EXAMPLES: https://pixijs.io/examples-v4/#/
 */
import * as PIXI from "pixi.js";
import { ModelBuilder } from "./model";

const loadResources = (
  resources: {
    name: string;
    path: string;
    option?: Record<string, unknown>;
  }[]
) => {
  const loader = new PIXI.loaders.Loader();
  resources.forEach(({ name, path, option }) => {
    loader.add(name, path, option);
  });
  return new Promise<PIXI.loaders.ResourceDictionary>((resolve, reject) => {
    loader
      .load(
        (
          loader: PIXI.loaders.Loader,
          resources: PIXI.loaders.ResourceDictionary
        ) => resolve(resources)
      )
      .onError.add(reject);
  });
};

const onLoad = (
  resources: PIXI.loaders.ResourceDictionary,
  container: Element
) => {
  const { clientWidth: width, clientHeight: height } = container;
  const app = new PIXI.Application(width, height, {
    transparent: true,
  });

  const model = new ModelBuilder({
    moc: Live2DCubismCore.Moc.fromArrayBuffer(resources.moc.data),
    texture: resources.texture.texture,
  }).build();

  app.stage.addChild(model);
  app.stage.addChild(model.masks);
  app.ticker.add((deltaTime) => {
    model.update(deltaTime);
    model.masks.update(app.renderer);
  });
  model.addAnimation(0, resources.motion.data);
  model.playAnimation(0);
  container.appendChild(app.view);

  model.position = new PIXI.Point(width / 2, height / 2);
  model.scale = new PIXI.Point(width, height);
  model.masks.resize(width, height);
};

export const setup = (
  mocPath: string,
  texcurePath: string,
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
      path: texcurePath,
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
