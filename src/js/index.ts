/**
 * ◆処理フロー◆
 *
 * [ リソース読み込み ] → エラーならハンドリングして終了
 *   ↓
 * [ LIVE2Dモデル設定 ]
 *   ↓
 * [ PIXIアプリケーション設定 ]
 *   ↓
 * [ リサイズイベント設定 ]
 */

import * as PIXI from 'pixi.js';
import * as L2DPixi from './modules/l2dpixi_slim';
import * as L2DFrameWork from './modules/l2dframework';

loadResources(
    [
        {
            name: 'moc',
            path: '/Koharu/Koharu.moc3',
            option: {xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER}
        },
        {
            name: 'texture',
            path: '/Koharu/Koharu.png'
        },
        {
            name: 'motion',
            path: '/Koharu/Koharu.motion3.json',
            option: {xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON}
        }
    ]
)
    .then(onLoad)
    .catch(onLoadError);

/**
 * リソース読み込み
 */
function loadResources(
    resources: Array<{
        name: string,
        path: string,
        option?: object
    }>
): Promise<{
    loader: PIXI.loaders.Loader,
    resources: PIXI.loaders.ResourceDictionary
}> {
    const loader = new PIXI.loaders.Loader;

    // リソース追加
    resources.forEach(resource => {
        loader.add(resource.name, resource.path, resource.option)
    });

    // 読み込み開始
    return new Promise((resolve, reject) => {
        loader
            .load((loader: PIXI.loaders.Loader, resources: PIXI.loaders.ResourceDictionary) => resolve({loader, resources}))
            .onError.add(reject);
    });
}

/**
 * リソース読み込み後の設定
 */
function onLoad(
    {loader, resources}: {loader: PIXI.loaders.Loader, resources: PIXI.loaders.ResourceDictionary}
): void {
    // モデル設定
    const model = createModel(resources);
    const animation = L2DFrameWork.Animation.fromMotion3Json(resources['motion'].data);
    model.animator
        .getLayer("base")
        .play(animation);

    // pixi アプリケーション初期化
    const app = initApp(model);

    // リサイズイベント設定
    window.onresize = initResize(app, model);
}

/**
 * pixiモデルを生成して返す
 */
function createModel(resources: PIXI.loaders.ResourceDictionary): L2DPixi.Model {
    return new L2DPixi.ModelBuilder(resources['moc'].data)
        .addTexture(0, resources['texture'].texture)
        .addAnimatorLayer("base", L2DFrameWork.BuiltinAnimationBlenders.OVERRIDE, 1)
        .build();
}

/**
 * pixi アプリケーション設定
 */
function initApp(model: L2DPixi.Model): PIXI.Application {
    // id="#l2d"もしくはbodyにcanvasを追加
    const target = document.querySelector('#l2d') || document.body;
    const app = new PIXI.Application(target.clientWidth, target.clientHeight, {transparent : true});
    target.appendChild(app.view);

    // ステージへモデル追加
    app.stage.addChild(model);
    app.stage.addChild(model.masks);

    // 描画ループ
    app.ticker.add(deltaTime => {
        model.update(deltaTime);
        model.masks.update(app.renderer);
    });

    return app;
}

/**
 * リサイズイベントを設定して返す
 */
function initResize(app: PIXI.Application, model: L2DPixi.Model): () => void {
    const onResize = () => {
        // Keep 16:9 ratio.
        const width = window.innerWidth;
        const height = (width / 16.0) * 9.0;

        // Resize app.
        app.view.style.width = `${width}px`;
        app.view.style.height = `${height}px`;
        app.renderer.resize(width, height);

        // Resize model.
        model.position = new PIXI.Point((width * 0.5), (height * 0.5));
        model.scale = new PIXI.Point((model.position.x * 0.8), (model.position.x * 0.8));

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
function onLoadError(): void {/* TODO: handle loader error */}
