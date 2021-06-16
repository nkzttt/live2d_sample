/**
 * PIXI DOCS: https://pixijs.download/v5.3.10/docs/index.html
 * PIXI EXAMPLES: https://pixijs.io/examples/#/
 */
import * as PIXI from "pixi.js";
import { ModelBuilder } from "./model";

const loadResources = <Name extends string>(
  resourceData: {
    name: Name;
    path: string;
    option?: PIXI.ILoaderOptions;
  }[]
) => {
  const loader = PIXI.Loader.shared;
  resourceData.forEach(({ name, path, option }) => {
    loader.add(name, path, option);
  });
  return new Promise<Partial<Record<Name, PIXI.LoaderResource>>>(
    (resolve, reject) => {
      loader
        .load((loader, resources) => resolve(resources))
        .onError.add(reject);
    }
  );
};

const onLoad = (
  resources: Partial<Record<"moc" | "texture" | "motion", PIXI.LoaderResource>>,
  container: Element
) => {
  const { moc, texture, motion } = resources;
  if (!moc || !texture || !motion) {
    throw new Error("failed to load resources");
  }

  const { clientWidth: width, clientHeight: height } = container;
  const app = new PIXI.Application({ width, height, transparent: true });
  container.appendChild(app.view);

  const model = new ModelBuilder({
    mocBuffer: moc.data,
    texture: texture.texture,
  }).build();
  app.stage.addChild(model, model.masks);
  model.position.set(width / 2, height / 2);
  model.scale.set(width, height);
  model.masks.resize(width, height);

  model.addAnimation(0, motion.data);
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
      option: { xhrType: PIXI.LoaderResource.XHR_RESPONSE_TYPE.BUFFER },
    },
    {
      name: "texture",
      path: texturePath,
    },
    {
      name: "motion",
      path: motionPath,
      option: { xhrType: PIXI.LoaderResource.XHR_RESPONSE_TYPE.JSON },
    },
  ])
    .then((resources) => onLoad(resources, container))
    .catch((e: Error) => {
      console.error(e);
    });
};
