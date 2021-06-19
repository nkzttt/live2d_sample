/**
 * PIXI DOCS: https://pixijs.download/v5.3.10/docs/index.html
 * PIXI EXAMPLES: https://pixijs.io/examples/#/
 */
import * as PIXI from "pixi.js";
import { ModelBuilder } from "./model";

type ValidLive2DConfig = Required<NonNullable<typeof window.Live2DConfig>>;
const isValidLive2DConfigType = (
  live2DConfig: unknown
): live2DConfig is ValidLive2DConfig => {
  try {
    const { moc, texture, motions } = window.Live2DConfig as ValidLive2DConfig;
    return (
      !!moc &&
      !!texture &&
      !!motions &&
      Object.values(motions).every((value) => typeof value === "string")
    );
  } catch (e) {
    return false;
  }
};

type ResourceData = ({ option?: PIXI.ILoaderOptions } & (
  | {
      name: Exclude<keyof ValidLive2DConfig, "motions">;
      path: string;
    }
  | {
      name: "motions";
      paths: ValidLive2DConfig["motions"];
    }
))[];

type Resources = {
  [key in Exclude<
    keyof ValidLive2DConfig,
    "motions"
  >]: PIXI.LoaderResource | null;
} & {
  motions: Record<string, PIXI.LoaderResource | null>;
};

type ValidMotions = Record<string, PIXI.LoaderResource>;
const isValidMotions = (
  motions: Resources["motions"]
): motions is ValidMotions => {
  try {
    return Object.values(motions).every((value) => !!value);
  } catch (e) {
    return false;
  }
};

const loadResources = (resourceData: ResourceData) => {
  const loader = PIXI.Loader.shared;

  resourceData.forEach((resourceDatum) => {
    if (resourceDatum.name !== "motions") {
      loader.add(resourceDatum.name, resourceDatum.path, resourceDatum.option);
    } else {
      Object.entries(resourceDatum.paths).forEach(
        ([motionName, motionPath]) => {
          loader.add(
            `${resourceDatum.name}_${motionName}`,
            motionPath,
            resourceDatum.option
          );
        }
      );
    }
  });

  return new Promise<Resources>((resolve, reject) => {
    loader
      .load((_, resources) => {
        const returnResources: Resources = {
          moc: null,
          texture: null,
          motions: {},
        };

        Object.entries(resources).forEach(([key, resource]) => {
          const matched = key.match(/^motions_(.+)$/);
          if (matched) {
            returnResources.motions = {
              ...returnResources.motions,
              [matched[1]]: resource || null,
            };
          } else {
            returnResources[
              key as Exclude<keyof ValidLive2DConfig, "motions">
            ] = resource || null;
          }
        });
        resolve(returnResources);
      })
      .onError.add(reject);
  });
};

const createApp = (resources: Resources, container: Element) => {
  const { moc, texture, motions } = resources;
  if (
    !moc ||
    !texture ||
    !Object.keys(motions).length ||
    !isValidMotions(motions)
  ) {
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

  Object.keys(motions).forEach((motionName) =>
    model.addAnimation(motionName, motions[motionName].data)
  );

  app.ticker.add((deltaTime) => {
    model.update(deltaTime);
    model.masks.update(app.renderer);
  });

  return { app, model };
};

export const setup = async () => {
  if (!isValidLive2DConfigType(window.Live2DConfig)) {
    console.warn("missing valid Live2DConfig.");
    return;
  }

  const container = document.querySelector("#l2d");
  if (!container) return;

  try {
    const resources = await loadResources([
      {
        name: "moc",
        path: window.Live2DConfig.moc,
        option: { xhrType: PIXI.LoaderResource.XHR_RESPONSE_TYPE.BUFFER },
      },
      {
        name: "texture",
        path: window.Live2DConfig.texture,
      },
      {
        name: "motions",
        paths: window.Live2DConfig.motions,
        option: { xhrType: PIXI.LoaderResource.XHR_RESPONSE_TYPE.JSON },
      },
    ]);

    return createApp(resources, container);
  } catch (e) {
    console.error(e);
  }
};
