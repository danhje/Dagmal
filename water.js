/*
 * Live water for the beach backdrop.
 *
 * Draws the sea band of the `.sky` scene with a small WebGL shader: layered
 * directional ripples whose gradient stands in for the two scrolling normal
 * maps a three.js `Water2` surface blends together, plus sun glitter, crest
 * foam and a hazy sky reflection toward the horizon.
 *
 * Deliberately hand-written instead of pulling in three.js: no dependency, no
 * remote textures, works offline. If anything is missing (no WebGL) or the
 * user prefers reduced motion, we simply never start and the CSS shimmer in
 * the SVG stays visible instead.
 */
(function () {
  "use strict";

  // Where the water lives inside the SVG's own coordinate system. Kept a
  // touch beyond the visible band so it tucks under the sky and the sand.
  var HORIZON_SVG_Y = 284;
  var SHORE_SVG_Y = 472;

  var MAX_DPR = 1.5;
  var FRAME_MS = 1000 / 30; // 30fps is plenty for water, and halves the work

  var sky = document.querySelector(".sky");
  var scene = document.querySelector(".scene");
  var canvas = document.querySelector(".sea-canvas");
  if (!sky || !scene || !canvas) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  var VERT = [
    "attribute vec2 aPos;",
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }"
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "uniform vec2 uRes;",
    "uniform float uTime;",
    "uniform float uHorizon;",
    "uniform float uShore;",
    "uniform float uCenterX;",
    "uniform vec3 uDeep;",
    "uniform vec3 uShallow;",
    "uniform vec3 uSky;",

    // Gradient of a sum of directional ripples. `damp` thins out the fine
    // octaves in the distance, where a pixel covers many wavelengths and the
    // detail would just alias into noise.
    "vec2 ripples(vec2 p, float t, float damp) {",
    "  vec2 grad = vec2(0.0);",
    "  float amp = 1.0;",
    "  float freq = 1.0;",
    "  float ang = 0.0;",
    "  float d = 1.0;",
    "  for (int i = 0; i < 7; i++) {",
    "    vec2 dir = vec2(cos(ang), sin(ang));",
    "    float phase = dot(p, dir) * freq + t * (0.7 + 0.4 * float(i));",
    "    grad += dir * amp * freq * cos(phase) * d;",
    "    amp *= 0.58;",
    "    freq *= 1.8;",
    "    ang += 2.3999632;", // golden angle: spreads the wave directions
    "    d *= damp;",
    "  }",
    "  return grad;",
    "}",

    "void main() {",
    "  vec2 fc = gl_FragCoord.xy;",
    "  float y = uRes.y - fc.y;",
    "  float t = (y - uHorizon) / max(uShore - uHorizon, 1.0);",
    "  if (t < 0.0 || t > 1.0) discard;",

    "  float fade = smoothstep(0.0, 0.14, t);",
    // Perspective: the same surface seen from further away, so ripples pack
    // together toward the horizon on their own.
    "  float depth = 1.0 / (t + 0.045);",
    "  vec2 p = vec2((fc.x - uCenterX) / uRes.y * depth * 6.0, depth * 4.5);",

    "  vec2 g = ripples(p + vec2(-uTime * 0.10, 0.0), uTime, mix(0.22, 1.0, fade));",
    "  g += 0.55 * ripples(p * 2.4 + vec2(uTime * 0.08, -uTime * 0.05), uTime * 1.35, mix(0.14, 1.0, fade));",
    // Compress the gradient into a bounded slope so the highlights stay
    // crinkly instead of clipping into big flat sheets of white.
    "  vec2 gn = g / (1.0 + 0.9 * length(g));",

    "  vec3 col = mix(uDeep, uShallow, smoothstep(0.0, 1.0, 0.15 + t * 0.85));",
    "  col = mix(col, uSky, 0.75 * pow(1.0 - t, 2.0));",

    // Sun glitter: wave faces tilted toward the sun catch the light, and the
    // whole thing is brightest along the sun's path across the water.
    "  float slope = dot(normalize(vec2(0.35, 1.0)), gn);",
    "  float glint = pow(smoothstep(0.28, 0.92, slope), 4.0);",
    "  float sunPath = exp(-pow((fc.x - uCenterX - 0.18 * uRes.x) / (0.30 * uRes.x), 2.0));",
    "  col += vec3(1.0) * glint * fade * (0.14 + 0.34 * sunPath);",

    "  float crest = smoothstep(0.80, 1.0, length(gn));",
    "  col = mix(col, vec3(1.0), crest * 0.18 * fade);",

    // Foam gathering where the water meets the sand.
    "  float foam = smoothstep(0.86, 1.0, t) * (0.55 + 0.45 * sin(p.x * 3.0 + uTime * 0.8));",
    "  col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.45);",

    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power"
  });
  if (!gl) return;

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    return sh;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  function uniform(name) { return gl.getUniformLocation(prog, name); }
  var uRes = uniform("uRes");
  var uTime = uniform("uTime");
  var uHorizon = uniform("uHorizon");
  var uShore = uniform("uShore");
  var uCenterX = uniform("uCenterX");

  // The palette comes from the same CSS custom properties the SVG uses, so
  // the live water stays in step with the rest of the theme.
  function cssColor(name, fallback) {
    var raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    var hex = raw.replace("#", "");
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    if (isNaN(n)) n = parseInt(fallback.replace("#", ""), 16);
    // sRGB -> rough linear, so the mixes in the shader don't go muddy
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  gl.uniform3fv(uniform("uDeep"), cssColor("--sea-deep", "#2d8fae"));
  gl.uniform3fv(uniform("uShallow"), cssColor("--sea-light", "#7fdccf"));
  gl.uniform3fv(uniform("uSky"), cssColor("--sky-bottom", "#cdeefd"));

  // Map the SVG's horizon and waterline into canvas pixels. The scene is
  // drawn with preserveAspectRatio="slice", so this has to be measured from
  // the live transform rather than assumed.
  function measure() {
    var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    var w = Math.max(sky.clientWidth, 1);
    var h = Math.max(sky.clientHeight, 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    var ctm = scene.getScreenCTM();
    var rect = sky.getBoundingClientRect();
    var horizon, shore, centerX;
    if (ctm) {
      horizon = new DOMPoint(800, HORIZON_SVG_Y).matrixTransform(ctm).y - rect.top;
      shore = new DOMPoint(800, SHORE_SVG_Y).matrixTransform(ctm).y - rect.top;
      centerX = new DOMPoint(800, HORIZON_SVG_Y).matrixTransform(ctm).x - rect.left;
    } else {
      horizon = h * 0.44;
      shore = h * 0.73;
      centerX = w / 2;
    }

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uHorizon, horizon * dpr);
    gl.uniform1f(uShore, shore * dpr);
    gl.uniform1f(uCenterX, centerX * dpr);
  }

  var started = false;
  var last = 0;
  var raf = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    gl.uniform1f(uTime, now / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!started) {
      started = true;
      document.body.classList.add("water-live");
    }
  }

  function start() {
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  measure();
  start();

  // Don't burn a GPU loop on a tablet sitting on a kitchen counter with the
  // screen off or the tab in the background.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 120);
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  if (typeof reduceMotion.addEventListener === "function") {
    reduceMotion.addEventListener("change", function (e) {
      if (e.matches) {
        stop();
        document.body.classList.remove("water-live");
      } else {
        measure();
        start();
      }
    });
  }

  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    stop();
    document.body.classList.remove("water-live");
  });
})();
