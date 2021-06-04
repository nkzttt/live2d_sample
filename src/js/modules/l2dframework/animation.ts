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

export type IAnimationCrossfadeWeighter = (
  time: number,
  duration: number
) => number;

export class AnimatorBuilder {
  private _target: Live2DCubismCore.Model;
  private _timeScale: number = 1;
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
      crossfadeWeighter: BuiltinCrossfadeWeighters.LINEAR,
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
  private _time: number = 0;
  private _goalAnimation: Animation | null = null;
  private _goalTime: number = 0;
  private _fadeTime: number = 0;
  private _fadeDuration: number = 0;
  private _play: boolean = false;

  public blend: IAnimationBlender = builtinAnimationBlenders.override;
  public weightCrossfade: IAnimationCrossfadeWeighter =
    BuiltinCrossfadeWeighters.LINEAR;
  public weight: number = 1;

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

  public play(animation: Animation, fadeDuration: number = 0) {
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
    const stackFlags = new Array(paramStackFlags, partsStackFlags);
    this._layer._evaluate(this._target, stackFlags);
  }
}

// Cubism animation segment evaluator
export interface IAnimationSegmentEvaluator {
  (points: Array<AnimationPoint>, offset: number, time: number): number;
}

/**
 * Cubism animation
 */
export class Animation {
  public duration: number;
  public fps: number;
  public loop: boolean;
  public userDataCount: number;
  public totalUserDataSize: number;
  public modelTracks: Array<AnimationTrack> = [];
  public parameterTracks: Array<AnimationTrack> = [];
  public partOpacityTracks: Array<AnimationTrack> = [];
  public userDataBodys: Array<AnimationUserDataBody> = [];
  private _callbackFunctions: Array<(arg: string) => void> = [];
  private _lastTime: number = 0;

  constructor(motion3Json: any) {
    // Deserialize meta.
    this.duration = motion3Json["Meta"]["Duration"];
    this.fps = motion3Json["Meta"]["Fps"];
    this.loop = motion3Json["Meta"]["Loop"];
    this.userDataCount = motion3Json["Meta"]["UserDataCount"];
    this.totalUserDataSize = motion3Json["Meta"]["TotalUserDataSize"];

    // Deserialize user data.
    if (motion3Json["UserData"] != null) {
      motion3Json["UserData"].forEach((u: any) => {
        // Deserialize animation user data body.
        this.userDataBodys.push(
          new AnimationUserDataBody(u["Time"], u["Value"])
        );
      });
      console.assert(this.userDataBodys.length === this.userDataCount);
    }

    // Deserialize tracks.
    motion3Json["Curves"].forEach((c: any) => {
      // Deserialize segments.
      let s = c["Segments"];

      let points: Array<AnimationPoint> = [];
      let segments: Array<AnimationSegment> = [];

      points.push(new AnimationPoint(s[0], s[1]));

      for (let t = 2; t < s.length; t += 3) {
        let offset = points.length - 1;
        let evaluate = BuiltinAnimationSegmentEvaluators.LINEAR;

        // Handle segment types.
        switch (s[t]) {
          case 1:
            evaluate = BuiltinAnimationSegmentEvaluators.BEZIER;
            points.push(new AnimationPoint(s[t + 1], s[t + 2]));
            points.push(new AnimationPoint(s[t + 3], s[t + 4]));
            t += 4;
            break;
          case 2:
            evaluate = BuiltinAnimationSegmentEvaluators.STEPPED;
            break;
          case 3:
            evaluate = BuiltinAnimationSegmentEvaluators.INVERSE_STEPPED;
            break;
          default:
            // TODO Handle unexpected segment type.
            break;
        }

        // Push segment and point.
        points.push(new AnimationPoint(s[t + 1], s[t + 2]));
        segments.push(new AnimationSegment(offset, evaluate));
      }

      // Create track.
      let track = new AnimationTrack(c["Id"], points, segments);

      // Push track.
      switch (c["Target"]) {
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
          // TODO Handle unexpected target.
          break;
      }
    });
  }

  public addAnimationCallback(callbackFunc: (arg: string) => void): void {
    this._callbackFunctions.push(callbackFunc);
  }

  public removeAnimationCallback(callbackFunc: (arg: string) => void): void {
    for (let _index = 0; _index < this._callbackFunctions.length; _index++) {
      if (this._callbackFunctions[_index] === callbackFunc) {
        this._callbackFunctions.splice(_index, 1);
        return;
      }
    }
  }

  public clearAnimationCallback(): void {
    this._callbackFunctions = [];
  }

  private callAnimationCallback(value: string): void {
    this._callbackFunctions.forEach((cb) => cb(value));
  }

  public evaluate(
    time: number,
    weight: number,
    blend: IAnimationBlender,
    target: Live2DCubismCore.Model,
    stackFlags: any,
    groups: any = null
  ): void {
    // Return early if influence is minimal.
    if (weight <= 0.01) return;

    // Loop animation time if requested.
    if (this.loop) {
      while (time > this.duration) {
        time -= this.duration;
      }
    }

    // Evaluate tracks and apply results.
    this.parameterTracks.forEach((t) => {
      let p = target.parameters.ids.indexOf(t.targetId);
      if (p >= 0) {
        if (stackFlags[0][p] != true) {
          target.parameters.values[p] = target.parameters.defaultValues[p];
          stackFlags[0][p] = true;
        }

        target.parameters.values[p] = blend(
          target.parameters.values[p],
          t.evaluate(time),
          t.evaluate(0),
          weight
        );
      }
    });

    this.partOpacityTracks.forEach((t) => {
      let p = target.parts.ids.indexOf(t.targetId);
      if (p >= 0) {
        if (stackFlags[1][p] != true) {
          target.parts.opacities[p] = 1;
          stackFlags[1][p] = true;
        }

        target.parts.opacities[p] = blend(
          target.parts.opacities[p],
          t.evaluate(time),
          t.evaluate(0),
          weight
        );
      }
    });

    // Evaluate model tracks.
    this.modelTracks.forEach((t) => {
      if (groups != null) {
        let g = groups.getGroupById(t.targetId);
        if (g != null && g.target === "Parameter") {
          for (let tid of g.ids) {
            let p = target.parameters.ids.indexOf(tid);
            if (p >= 0) {
              if (stackFlags[0][p] != true) {
                target.parameters.values[p] =
                  target.parameters.defaultValues[p];
                stackFlags[0][p] = true;
              }

              target.parameters.values[p] = blend(
                target.parameters.values[p],
                t.evaluate(time),
                t.evaluate(0),
                weight
              );
            }
          }
        }
      }
    });

    // Check user data event.
    if (this._callbackFunctions != null) {
      for (let ud of this.userDataBodys) {
        if (
          this.isEventTriggered(
            <number>ud.time,
            time,
            this._lastTime,
            this.duration
          )
        )
          this.callAnimationCallback(ud.value);
      }
    }

    this._lastTime = time;
  }

  /** 'true' if user data's time value is inside of range. */
  private isEventTriggered(
    timeEvaluate: number,
    timeForward: number,
    timeBack: number,
    duration: number
  ): boolean {
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

/**
 * Builtin Cubims crossfade
 */
export class BuiltinCrossfadeWeighters {
  public static LINEAR(time: number, duration: number): number {
    return time / duration;
  }
}

/** Cubism animation track. */
export class AnimationTrack {
  constructor(
    public targetId: string,
    public points: Array<AnimationPoint>,
    public segments: Array<AnimationSegment>
  ) {}

  public evaluate(time: number): number {
    // Find segment to evaluate.
    let s = 0;
    let lastS = this.segments.length - 1;
    for (; s < lastS; ++s) {
      if (this.points[this.segments[s + 1].offset].time >= time) break;
    }

    // Evaluate segment.
    // TODO Passing segment offset somewhat to itself is awkward. Improve it?
    return this.segments[s].evaluate(
      this.points,
      this.segments[s].offset,
      time
    );
  }
}

/**
 * Unit of animation user data
 */
export class AnimationUserDataBody {
  public constructor(public time: number, public value: string) {}
}

/**
 * Cubism animation point
 */
export class AnimationPoint {
  public constructor(public time: number, public value: number) {}
}

/**
 * Cubism animation track segment
 */
export class AnimationSegment {
  public constructor(
    public offset: number,
    public evaluate: IAnimationSegmentEvaluator
  ) {}
}

/**
 * Builtin Cubism animation segment evaluators
 */
export class BuiltinAnimationSegmentEvaluators {
  public static LINEAR: IAnimationSegmentEvaluator = function (
    points: Array<AnimationPoint>,
    offset: number,
    time: number
  ): number {
    let p0 = points[offset + 0];
    let p1 = points[offset + 1];
    let t = (time - p0.time) / (p1.time - p0.time);
    return p0.value + (p1.value - p0.value) * t;
  };

  public static BEZIER: IAnimationSegmentEvaluator = function (
    points: Array<AnimationPoint>,
    offset: number,
    time: number
  ): number {
    let t =
      (time - points[offset + 0].time) /
      (points[offset + 3].time - points[offset].time);

    let p01 = BuiltinAnimationSegmentEvaluators.lerp(
      points[offset + 0],
      points[offset + 1],
      t
    );
    let p12 = BuiltinAnimationSegmentEvaluators.lerp(
      points[offset + 1],
      points[offset + 2],
      t
    );
    let p23 = BuiltinAnimationSegmentEvaluators.lerp(
      points[offset + 2],
      points[offset + 3],
      t
    );

    let p012 = BuiltinAnimationSegmentEvaluators.lerp(p01, p12, t);
    let p123 = BuiltinAnimationSegmentEvaluators.lerp(p12, p23, t);

    return BuiltinAnimationSegmentEvaluators.lerp(p012, p123, t).value;
  };

  public static STEPPED: IAnimationSegmentEvaluator = function (
    points: Array<AnimationPoint>,
    offset: number,
    time: number
  ): number {
    return points[offset + 0].value;
  };

  public static INVERSE_STEPPED: IAnimationSegmentEvaluator = function (
    points: Array<AnimationPoint>,
    offset: number,
    time: number
  ): number {
    return points[offset + 1].value;
  };

  private static lerp(
    a: AnimationPoint,
    b: AnimationPoint,
    t: number
  ): AnimationPoint {
    return new AnimationPoint(
      a.time + (b.time - a.time) * t,
      a.value + (b.value - a.value) * t
    );
  }
}
