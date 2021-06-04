import * as PIXI from "pixi.js";
import { ModelBuilder, Model } from "./modules/l2dpixi";

const loadResources = (
  resources: {
    name: string;
    path: string;
    option?: object;
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

const onLoad = (resources: PIXI.loaders.ResourceDictionary) => {
  const builder = new ModelBuilder({
    moc: Live2DCubismCore.Moc.fromArrayBuffer(resources.moc.data),
    texture: resources.texture.texture,
  });
  const model = builder.build();

  // アニメーション再生
  model.addAnimation(0, resources.motion.data);
  model.playAnimation("base", 0);

  // id="#l2d"もしくはbodyにcanvasを追加
  const target = document.querySelector("#l2d") || document.body;
  const app = new PIXI.Application(target.clientWidth, target.clientHeight, {
    transparent: true,
  });
  target.appendChild(app.view);

  // ステージへモデル追加
  app.stage.addChild(model);
  app.stage.addChild(model.masks);

  // 描画ループ
  app.ticker.add((deltaTime) => {
    model.update(deltaTime);
    model.masks.update(app.renderer);
  });

  // リサイズイベント設定
  window.onresize = initResize(app, model);
};

loadResources([
  {
    name: "moc",
    path: "/Koharu/Koharu.moc3",
    option: { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER },
  },
  {
    name: "texture",
    path: "/Koharu/Koharu.png",
  },
  {
    name: "motion",
    path: "/Koharu/Koharu.motion3.json",
    option: { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON },
  },
])
  .then(onLoad)
  .catch(onLoadError);

/**
 * リサイズイベントを設定して返す
 */
function initResize(app: PIXI.Application, model: Model): () => void {
  const onResize = () => {
    // Keep 16:9 ratio.
    const width = window.innerWidth;
    const height = (width / 16.0) * 9.0;

    // Resize app.
    app.view.style.width = `${width}px`;
    app.view.style.height = `${height}px`;
    app.renderer.resize(width, height);

    // Resize model.
    model.position = new PIXI.Point(width * 0.5, height * 0.5);
    model.scale = new PIXI.Point(
      model.position.x * 0.8,
      model.position.x * 0.8
    );

    // Resize mask texture.
    model.masks.resize(app.view.width, app.view.height);
  };

  // 描画時に即実行
  onResize();

  // 処理返却
  return onResize;
}

/**
 * リソース読み込み失敗ハンドリング
 */
function onLoadError(): void {
  /* TODO: handle loader error */
}
