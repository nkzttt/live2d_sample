import * as PIXI from 'pixi.js';

// リソース読み込み後の初期化
const setup = (loader: PIXI.loaders.Loader, resources: PIXI.loaders.ResourceDictionary) => {
    const moc = Live2DCubismCore.Moc.fromArrayBuffer(resources['moc'].data);
    console.log(moc);
};

// リソース読み込み
PIXI.loader
    .add('moc', '/Koharu/Koharu.moc3', { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER })
    .add('texcure', '/Koharu/Koharu.png')
    .add('motion', '/Koharu/Koharu.motion3.json', { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON })
    .load(setup);
