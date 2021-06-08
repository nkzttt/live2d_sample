export type IAnimationBlender = (
  source: number,
  destination: number,
  initial: number,
  weight: number
) => number;

export const builtinAnimationBlenders: Record<
  "override" | "add" | "multiply",
  IAnimationBlender
> = {
  override: (source, destination, initial, weight) =>
    destination * weight + source * (1 - weight),
  add: (source, destination, initial, weight) =>
    source + (destination - initial) * weight,
  multiply: (source, destination, weight) =>
    source * (1 + (destination - 1) * weight),
};

type IAnimationCrossfadeWeighter = (time: number, duration: number) => number;

const builtinCrossfadeWeighters: Record<
  "linear",
  (time: number, duration: number) => number
> = {
  linear: (time, duration) => time / duration,
};

export class AnimatorBuilder {
  private _target: Live2DCubismCore.Model;
  private _timeScale = 1;
  private _layer: {
    blender: IAnimationBlender;
    crossfadeWeighter: IAnimationCrossfadeWeighter;
    weight: number;
  };

  constructor({
    target,
    timeScale,
    layer,
  }: {
    target: AnimatorBuilder["_target"];
    timeScale: AnimatorBuilder["_timeScale"];
    layer: Partial<AnimatorBuilder["_layer"]>;
  }) {
    this._target = target;
    this._timeScale = timeScale;
    this._layer = {
      blender: layer.blender || builtinAnimationBlenders.override,
      crossfadeWeighter: builtinCrossfadeWeighters.linear,
      weight: layer.weight || 1,
    };
  }

  public build() {
    const layer = new AnimationLayer();
    layer.blend = this._layer.blender;
    layer.weightCrossfade = this._layer.crossfadeWeighter;
    layer.weight = this._layer.weight;
    return new Animator(this._target, this._timeScale, layer);
  }
}

class AnimationLayer {
  private _animation: Animation | null = null;
  private _time = 0;
  private _goalAnimation: Animation | null = null;
  private _goalTime = 0;
  private _fadeTime = 0;
  private _fadeDuration = 0;
  private _play = false;

  public blend: IAnimationBlender = builtinAnimationBlenders.override;
  public weightCrossfade: IAnimationCrossfadeWeighter =
    builtinCrossfadeWeighters.linear;
  public weight = 1;

  get currentAnimation() {
    return this._animation;
  }

  get currentTime() {
    return this._time;
  }

  set currentTime(value: number) {
    this._time = value;
  }

  get isPlaying() {
    return this._play;
  }

  public play(animation: Animation, fadeDuration = 0) {
    if (this._animation && fadeDuration > 0) {
      this._goalAnimation = animation;
      this._goalTime = 0;

      this._fadeTime = 0;
      this._fadeDuration = fadeDuration;
    } else {
      this._animation = animation;
      this.currentTime = 0;
      this._play = true;
    }
  }

  public resume() {
    this._play = true;
  }

  public pause() {
    this._play = false;
  }

  public stop() {
    this._play = false;
    this.currentTime = 0;
  }

  public _update(deltaTime: number) {
    if (!this._play) return;

    this._time += deltaTime;
    this._goalTime += deltaTime;
    this._fadeTime += deltaTime;
  }

  public _evaluate(target: Live2DCubismCore.Model, stackFlags: any) {
    if (!this._animation) return;

    const weight = Math.min(this.weight, 1);

    const animationWeight = this._goalAnimation
      ? weight * this.weightCrossfade(this._fadeTime, this._fadeDuration)
      : weight;
    this._animation.evaluate(
      this._time,
      animationWeight,
      this.blend,
      target,
      stackFlags
    );

    if (!this._goalAnimation) return;

    const goalAnimationWeight =
      1 - weight * this.weightCrossfade(this._fadeTime, this._fadeDuration);
    this._goalAnimation.evaluate(
      this._goalTime,
      goalAnimationWeight,
      this.blend,
      target,
      stackFlags
    );

    if (this._fadeTime > this._fadeDuration) {
      this._animation = this._goalAnimation;
      this._time = this._goalTime;
      this._goalAnimation = null;
    }
  }
}

export class Animator {
  private _target: Live2DCubismCore.Model;
  private _timeScale: number;
  private _layer: AnimationLayer;

  get timeScale() {
    return this._timeScale;
  }

  get target() {
    return this._target;
  }

  constructor(
    target: Animator["_target"],
    timeScale: Animator["_timeScale"],
    layer: Animator["_layer"]
  ) {
    this._target = target;
    this._timeScale = timeScale;
    this._layer = layer;
  }

  public getLayer() {
    return this._layer;
  }

  public updateAndEvaluate(deltaTime: number) {
    deltaTime *= Math.max(this.timeScale, 0);

    if (deltaTime > 0.001) {
      this._layer._update(deltaTime);
    }

    const paramStackFlags = new Array(this._target.parameters.count).fill(
      false
    );
    const partsStackFlags = new Array(this._target.parts.count).fill(false);
    const stackFlags = [paramStackFlags, partsStackFlags];
    this._layer._evaluate(this._target, stackFlags);
  }
}

type AnimationPoint = {
  time: number;
  value: number;
};

type IAnimationSegmentEvaluator = (
  points: Array<AnimationPoint>,
  offset: number,
  time: number
) => number;

type AnimationSegment = {
  offset: number;
  evaluate: IAnimationSegmentEvaluator;
};

const builtinAnimationSegmentEvaluators: Record<
  "linear" | "bezier" | "stepped" | "inverseStepped",
  IAnimationSegmentEvaluator
> = {
  linear: (points, offset, time) => {
    const p0 = points[offset + 0];
    const p1 = points[offset + 1];
    const t = (time - p0.time) / (p1.time - p0.time);
    return p0.value + (p1.value - p0.value) * t;
  },
  bezier: (points, offset, time) => {
    const lerp = (a: AnimationPoint, b: AnimationPoint, t: number) => ({
      time: a.time + (b.time - a.time) * t,
      value: a.value + (b.value - a.value) * t,
    });

    const t =
      (time - points[offset + 0].time) /
      (points[offset + 3].time - points[offset].time);
    const p01 = lerp(points[offset + 0], points[offset + 1], t);
    const p12 = lerp(points[offset + 1], points[offset + 2], t);
    const p23 = lerp(points[offset + 2], points[offset + 3], t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);

    return lerp(p012, p123, t).value;
  },
  stepped: (points, offset) => points[offset + 0].value,
  inverseStepped: (points, offset) => points[offset + 1].value,
};

class AnimationTrack {
  constructor(
    public targetId: string,
    public points: AnimationPoint[],
    public segments: AnimationSegment[]
  ) {}

  public evaluate(time: number) {
    const s =
      this.segments.length > 1
        ? this.segments.findIndex((_segment, i) => {
            if (i === this.segments.length - 1) return true;
            return this.points[this.segments[i + 1].offset].time >= time;
          })
        : 0;
    return this.segments[s].evaluate(
      this.points,
      this.segments[s].offset,
      time
    );
  }
}

export class Animation {
  public duration: number;
  public fps: number;
  public loop: boolean;
  public userDataCount: number;
  public totalUserDataSize: number;
  public modelTracks: AnimationTrack[] = [];
  public parameterTracks: AnimationTrack[] = [];
  public partOpacityTracks: AnimationTrack[] = [];
  public userDataBodys: { time: number; value: string }[] = [];
  private _callbackFunctions: Array<(arg: string) => void> = [];
  private _lastTime = 0;

  // TODO: type guard
  constructor(motion3Json: any) {
    this.duration = motion3Json["Meta"]["Duration"];
    this.fps = motion3Json["Meta"]["Fps"];
    this.loop = motion3Json["Meta"]["Loop"];
    this.userDataCount = motion3Json["Meta"]["UserDataCount"];
    this.totalUserDataSize = motion3Json["Meta"]["TotalUserDataSize"];
    if (motion3Json["UserData"]) {
      this.userDataBodys = motion3Json["UserData"].map((u: any) => ({
        time: u["Time"],
        value: u["Value"],
      }));
    }
    motion3Json["Curves"].forEach((curve: any) => {
      const s = curve["Segments"];
      const points: AnimationPoint[] = [{ time: s[0], value: s[1] }];
      const segments: AnimationSegment[] = [];

      for (let t = 2; t < s.length; t += 3) {
        const offset = points.length - 1;
        switch (s[t]) {
          case 1:
            points.push({ time: s[t + 1], value: s[t + 2] });
            points.push({ time: s[t + 3], value: s[t + 4] });
            t += 4;
            segments.push({
              offset,
              evaluate: builtinAnimationSegmentEvaluators.bezier,
            });
            break;
          case 2:
            segments.push({
              offset,
              evaluate: builtinAnimationSegmentEvaluators.stepped,
            });
            break;
          case 3:
            segments.push({
              offset,
              evaluate: builtinAnimationSegmentEvaluators.inverseStepped,
            });
            break;
          default:
            segments.push({
              offset,
              evaluate: builtinAnimationSegmentEvaluators.linear,
            });
            break;
        }

        points.push({ time: s[t + 1], value: s[t + 2] });
      }

      const track = new AnimationTrack(curve["Id"], points, segments);
      switch (curve["Target"]) {
        case "Model":
          this.modelTracks.push(track);
          break;
        case "Parameter":
          this.parameterTracks.push(track);
          break;
        case "PartOpacity":
          this.partOpacityTracks.push(track);
          break;
        default:
          break;
      }
    });
  }

  public addAnimationCallback(callback: (arg: string) => void) {
    this._callbackFunctions.push(callback);
  }

  public removeAnimationCallback(callback: (arg: string) => void) {
    const index = this._callbackFunctions.indexOf(callback);
    if (index !== -1) {
      this._callbackFunctions.splice(index, 1);
    }
  }

  public clearAnimationCallback() {
    this._callbackFunctions = [];
  }

  private callAnimationCallback(value: string) {
    this._callbackFunctions.forEach((cb) => cb(value));
  }

  public evaluate(
    time: number,
    weight: number,
    blend: IAnimationBlender,
    target: Live2DCubismCore.Model,
    stackFlags: any,
    groups: any = null
  ) {
    if (weight <= 0.01) return;

    if (this.loop) {
      while (time > this.duration) {
        time -= this.duration;
      }
    }

    this.parameterTracks.forEach((track) => {
      const parametersId = target.parameters.ids.indexOf(track.targetId);
      if (parametersId === -1) return;

      if (!stackFlags[0][parametersId]) {
        target.parameters.values[parametersId] =
          target.parameters.defaultValues[parametersId];
        stackFlags[0][parametersId] = true;
      }

      target.parameters.values[parametersId] = blend(
        target.parameters.values[parametersId],
        track.evaluate(time),
        track.evaluate(0),
        weight
      );
    });

    this.partOpacityTracks.forEach((track) => {
      const partsId = target.parts.ids.indexOf(track.targetId);
      if (partsId === -1) return;

      if (!stackFlags[1][partsId]) {
        target.parts.opacities[partsId] = 1;
        stackFlags[1][partsId] = true;
      }

      target.parts.opacities[partsId] = blend(
        target.parts.opacities[partsId],
        track.evaluate(time),
        track.evaluate(0),
        weight
      );
    });

    this.modelTracks.forEach((track) => {
      if (!groups) return;
      const group = groups.getGroupById(track.targetId);
      if (!(group && group.target === "Parameter")) return;
      group.ids.forEach((groupId: string) => {
        const parametersId = target.parameters.ids.indexOf(groupId);
        if (parametersId === -1) return;

        if (!stackFlags[0][parametersId]) {
          target.parameters.values[parametersId] =
            target.parameters.defaultValues[parametersId];
          stackFlags[0][parametersId] = true;
        }

        target.parameters.values[parametersId] = blend(
          target.parameters.values[parametersId],
          track.evaluate(time),
          track.evaluate(0),
          weight
        );
      });
    });

    if (this._callbackFunctions.length) {
      this.userDataBodys.forEach((userData) => {
        if (
          this.isEventTriggered(
            userData.time,
            time,
            this._lastTime,
            this.duration
          )
        )
          this.callAnimationCallback(userData.value);
      });
    }

    this._lastTime = time;
  }

  private isEventTriggered(
    timeEvaluate: number,
    timeForward: number,
    timeBack: number,
    duration: number
  ) {
    if (timeForward > timeBack) {
      if (timeEvaluate > timeBack && timeEvaluate < timeForward) return true;
    } else {
      if (
        (timeEvaluate > 0 && timeEvaluate < timeForward) ||
        (timeEvaluate > timeBack && timeEvaluate < duration)
      )
        return true;
    }
    return false;
  }
}
