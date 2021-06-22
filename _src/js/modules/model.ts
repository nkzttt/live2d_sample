/**
 * PIXI DOCS: https://pixijs.download/v5.3.10/docs/index.html
 * PIXI EXAMPLES: https://pixijs.io/examples/#/
 */
import * as PIXI from "pixi.js";
import * as animationFramework from "./animation";

export class ModelBuilder {
  private _moc: Live2DCubismCore.Moc;
  private _setTimeScale: number;
  private _texture: PIXI.Texture;
  private _animatorLayer: {
    blender: animationFramework.IAnimationBlender;
    weight: number;
  };

  constructor({
    mocBuffer,
    texture,
  }: {
    mocBuffer: ArrayBuffer;
    texture: ModelBuilder["_texture"];
  }) {
    this._moc = Live2DCubismCore.Moc.fromArrayBuffer(mocBuffer);
    this._setTimeScale = 1;
    this._texture = texture;
    this._animatorLayer = {
      blender: animationFramework.builtinAnimationBlenders.override,
      weight: 1,
    };
  }

  public build() {
    const coreModel = Live2DCubismCore.Model.fromMoc(this._moc);
    const animatorBuilder = new animationFramework.AnimatorBuilder({
      target: coreModel,
      timeScale: this._setTimeScale,
      layer: this._animatorLayer,
    });
    const animator = animatorBuilder.build();
    return new Model(coreModel, this._texture, animator);
  }
}

export class Model extends PIXI.Container {
  private _coreModel: Live2DCubismCore.Model;
  private _texture: PIXI.Texture;
  private _animator: animationFramework.Animator;
  private _animations: Record<string, animationFramework.Animation>;
  private _currentAnimation: string | null = null;
  private _meshes: PIXI.SimpleMesh[];
  private _maskSpriteContainer: MaskSpriteContainer;

  get coreModel() {
    return this._coreModel;
  }

  get texture() {
    return this._texture;
  }

  get animator() {
    return this._animator;
  }

  get animations() {
    return this._animations;
  }

  get meshes() {
    return this._meshes;
  }

  get masks() {
    return this._maskSpriteContainer;
  }

  constructor(
    coreModel: Model["_coreModel"],
    texture: Model["_texture"],
    animator: Model["_animator"]
  ) {
    super();

    this._coreModel = coreModel;
    this._texture = texture;
    this._animator = animator;
    this._animations = {};
    this._meshes = [];
    this._coreModel.drawables.ids.forEach((_id, idIndex) => {
      const mesh = new PIXI.SimpleMesh(
        texture,
        this._coreModel.drawables.vertexPositions[idIndex],
        this._coreModel.drawables.vertexUvs[idIndex].map((uv, uvIndex) => {
          const isEven = (uvIndex + 1) % 2 == 0;
          return isEven ? 1 - uv : uv;
        }),
        this._coreModel.drawables.indices[idIndex],
        PIXI.DRAW_MODES.TRIANGLES
      );
      mesh.name = this._coreModel.drawables.ids[idIndex];
      mesh.scale.y *= -1;
      mesh.zIndex = this._coreModel.drawables.renderOrders[idIndex];

      this.addChild(mesh);
      this._meshes.push(mesh);
    });
    this.sortableChildren = true;

    this._maskSpriteContainer = new MaskSpriteContainer(this);
  }

  public addAnimation(key: string, data: Record<string, unknown>) {
    const animation = new animationFramework.Animation(data);
    this._animations[key] = animation;
  }

  public playAnimation(key: string) {
    const animatorLayer = this.animator.getLayer();
    animatorLayer.play(this._animations[key]);
    this._currentAnimation = key;
  }

  public setNextAnimation(key: string) {
    const animatorLayer = this.animator.getLayer();
    animatorLayer.onAnimationEnd(() => {
      if (this._currentAnimation !== key) {
        animatorLayer.play(this._animations[key]);
        this._currentAnimation = key;
      }
    });
  }

  public update(delta: number) {
    this._animator.updateAndEvaluate(0.016 * delta);
    this._coreModel.update();

    this._meshes.forEach((mesh, i) => {
      mesh.alpha = this._coreModel.drawables.opacities[i];
      mesh.visible = Live2DCubismCore.Utils.hasIsVisibleBit(
        this._coreModel.drawables.dynamicFlags[i]
      );
      if (
        Live2DCubismCore.Utils.hasVertexPositionsDidChangeBit(
          this._coreModel.drawables.dynamicFlags[i]
        )
      ) {
        mesh.vertices = this._coreModel.drawables.vertexPositions[i];
      }
    });

    this._coreModel.drawables.resetDynamicFlags();
  }

  public destroy() {
    this._coreModel.release();
    super.destroy();
    this.masks.destroy();
    this._meshes.forEach((mesh) => mesh.destroy());
  }

  public getModelMeshById(id: string) {
    return this._meshes.find((mesh) => mesh.name === id);
  }
}

export class MaskSpriteContainer extends PIXI.Container {
  private _maskSprites: PIXI.Sprite[];
  private _maskMeshContainers: PIXI.Container[];
  private _maskTextures: PIXI.RenderTexture[];

  get maskSprites() {
    return this._maskSprites;
  }

  get maskMeshes() {
    return this._maskMeshContainers;
  }

  constructor(model: Model) {
    super();

    this._maskMeshContainers = [];
    this._maskTextures = [];
    this._maskSprites = [];

    model.meshes.forEach((_mesh, meshIndex) => {
      if (model.coreModel.drawables.maskCounts[meshIndex] === 0) return;

      const maskMeshContainer = new PIXI.Container();

      model.coreModel.drawables.masks[meshIndex].forEach((maskId) => {
        const maskMesh = new PIXI.SimpleMesh(
          model.texture,
          model.coreModel.drawables.vertexPositions[maskId],
          model.coreModel.drawables.vertexUvs[maskId].map((uv, uvIndex) => {
            const isEven = (uvIndex + 1) % 2 == 0;
            return isEven ? 1 - uv : uv;
          }),
          model.coreModel.drawables.indices[maskId],
          PIXI.DRAW_MODES.TRIANGLES
        );
        maskMesh.name = model.meshes[maskId].name;
        maskMesh.transform = model.meshes[maskId].transform;
        maskMeshContainer.addChild(maskMesh);
      });

      maskMeshContainer.transform = model.transform;
      this._maskMeshContainers.push(maskMeshContainer);

      const maskTexture = PIXI.RenderTexture.create();
      this._maskTextures.push(maskTexture);

      const maskSprite = new PIXI.Sprite(maskTexture);
      this._maskSprites.push(maskSprite);
      this.addChild(maskSprite);

      model.meshes[meshIndex].mask = maskSprite;
    });
  }

  public destroy() {
    this._maskSprites.forEach((sprite) => sprite.destroy());
    this._maskTextures.forEach((texture) => texture.destroy());
    this._maskMeshContainers.forEach((container) => container.destroy());
  }

  public update(appRenderer: PIXI.Renderer) {
    this._maskSprites.forEach((_sprite, i) => {
      appRenderer.render(this._maskMeshContainers[i], this._maskTextures[i]);
    });
  }

  public resize(viewWidth: number, viewHeight: number) {
    this._maskTextures.forEach((texture) => {
      texture.resize(viewWidth, viewHeight);
    });
  }
}
