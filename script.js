window.addEventListener('load', () => {

  // ─── WEBGL BACKGROUND ─────────────────────────────────────────────────────
  const canvas = document.querySelector('.background-canvas');
  const gl     = canvas.getContext('webgl');
  if (!gl) {
    console.error('WebGL not supported');
    return;
  }

  // set up size & viewport
  let width  = canvas.width  = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  function resizeCanvas() {
    width  = canvas.width  = window.innerWidth;
    height = canvas.height = window.innerHeight;
    gl.viewport(0, 0, width, height);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // track mouse for circles
  let mouse = { x: width / 2, y: height / 2 };
  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  window.addEventListener('mousemove', onMouseMove);

  // circle data
  const circleColors = [
    [30/255, 30/255, 30/255],
    [128/255,128/255,128/255],
    [220/255,220/255,220/255],
    [57/255, 1.0,    20/255],
    [15/255, 1.0,    80/255],
    [107/255,1.0,   158/255],
  ];
  let circles = [];
  function initCircles() {
    circles = [];
    const baseRadius = (width + height) * 0.2;
    for (let i = 0; i < 5; i++) {
      const radius = baseRadius;
      const x = Math.random() * width;
      const y = Math.random() * height;
      const speedMultiplier = Math.random() * 4 + 1;
      const vx = (Math.random() - 0.5) * speedMultiplier;
      const vy = (Math.random() - 0.5) * speedMultiplier;
      circles.push({ x, y, radius, color: circleColors[i], vx, vy, interactive: false });
    }
    // interactive circle
    const interactiveRadius = (width + height) * 0.1;
    circles.push({
      x: width / 2,
      y: height / 2,
      radius: interactiveRadius,
      color: circleColors[5],
      vx: 0, vy: 0,
      interactive: true,
    });
  }
  initCircles();

  // shaders
  const vertexSrc = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main(void) {
      v_uv = a_position * 0.5 + 0.5;
      v_uv.y = 1.0 - v_uv.y;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSrc = `
    precision mediump float;
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform int u_circleCount;
    uniform vec3 u_circlesColor[6];
    uniform vec3 u_circlesPosRad[6];
    uniform vec2 u_mouse;
    void main(void) {
      vec2 st = v_uv * u_resolution;
      vec3 topColor = vec3(0.0, 0.0, 0.0);
      vec3 bottomColor = vec3(0.5, 0.5, 0.5);
      vec3 bgColor = mix(topColor, bottomColor, st.y / u_resolution.y);
      float fieldSum = 0.0;
      vec3 weightedColorSum = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        if (i >= u_circleCount) break;
        vec3 posRad = u_circlesPosRad[i];
        vec2 cPos = vec2(posRad.r, posRad.g);
        float radius = posRad.b;
        float dist = length(st - cPos);
        float sigma = radius * 0.5;
        float val = exp(- (dist*dist)/(2.0*sigma*sigma));
        fieldSum += val;
        weightedColorSum += u_circlesColor[i] * val;
      }
      vec3 finalCirclesColor = fieldSum > 0.0 ? weightedColorSum/fieldSum : vec3(0.0);
      float intensity = pow(fieldSum, 1.4);
      vec3 finalColor = mix(bgColor, finalCirclesColor, clamp(intensity,0.0,1.0));
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;
  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  const vertShader = createShader(gl.VERTEX_SHADER, vertexSrc);
  const fragShader = createShader(gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);
  // quad
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
    gl.STATIC_DRAW
  );
  const a_position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(a_position);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
  // uniforms
  const u_resolution   = gl.getUniformLocation(program, 'u_resolution');
  const u_circleCount  = gl.getUniformLocation(program, 'u_circleCount');
  const u_circlesColor = gl.getUniformLocation(program, 'u_circlesColor');
  const u_circlesPosRad= gl.getUniformLocation(program, 'u_circlesPosRad');
  const u_mouse        = gl.getUniformLocation(program, 'u_mouse');
  gl.uniform2f(u_resolution, width, height);

  function updateCircles() {
    circles.forEach(c => {
      if (!c.interactive) {
        c.x += c.vx; c.y += c.vy;
        if (c.x - c.radius > width)  c.x = -c.radius;
        if (c.x + c.radius < 0)      c.x = width + c.radius;
        if (c.y - c.radius > height) c.y = -c.radius;
        if (c.y + c.radius < 0)      c.y = height + c.radius;
      } else {
        c.x += (mouse.x - c.x)*0.1;
        c.y += (mouse.y - c.y)*0.1;
      }
    });
  }
  function render() {
    updateCircles();
    gl.viewport(0,0,width,height);
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform1i(u_circleCount, circles.length);
    gl.uniform2f(u_resolution, width, height);
    gl.uniform2f(u_mouse, mouse.x, mouse.y);

    const colorsArr = [], posRadArr = [];
    for (let i = 0; i < 6; i++) {
      if (i < circles.length) {
        const c = circles[i];
        colorsArr.push(c.color[0], c.color[1], c.color[2]);
        posRadArr.push(c.x, c.y, c.radius);
      } else {
        colorsArr.push(0,0,0);
        posRadArr.push(0,0,0);
      }
    }
    gl.uniform3fv(u_circlesColor, new Float32Array(colorsArr));
    gl.uniform3fv(u_circlesPosRad,new Float32Array(posRadArr));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }
  render();


  // ─── LIVE CLOCK ──────────────────────────────────────────────────────────
  const clockEl = document.getElementById('clock');
  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    clockEl.textContent = `${hh}:${mm}:${ss}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ─── POMODORO DIALOGS & TIMER ───────────────────────────────────────────
  const setTimerBtn = document.getElementById('setTimerBtn');
  const addMusicBtn = document.getElementById('addMusicBtn');
  const pauseBtn    = document.getElementById('pauseBtn');
  const resetBtn    = document.getElementById('resetBtn');
  const countdownEl = document.getElementById('countdown');
  const timerDialog = document.getElementById('timerDialog');
  const musicDialog = document.getElementById('musicDialog');
  const workInput   = document.getElementById('workInput');
  const breakInput  = document.getElementById('breakInput');

  let timerInterval, remaining = 0, breakDur=0, inBreak=false, paused=false;

  setTimerBtn .addEventListener('click', () => timerDialog .showModal());
  addMusicBtn .addEventListener('click', () => musicDialog.showModal());
  document.querySelectorAll('.dialog-close').forEach(b =>
    b.addEventListener('click', () => b.closest('dialog').close())
  );

  document.getElementById('confirmTimer').addEventListener('click', () => {
    const w = parseInt(workInput.value)||30;
    const b = parseInt(breakInput.value)||5;
    remaining = w*60; breakDur=b*60; inBreak=false; paused=false;
    clockEl.classList.add('hidden');
    countdownEl.classList.remove('hidden');
    pauseBtn.classList.remove('hidden');
    timerDialog.close();
    tick();
    timerInterval = setInterval(() => {
      if (!paused) {
        remaining--;
        if (remaining < 0) {
          if (!inBreak) { inBreak=true; remaining=breakDur; }
          else          { clearInterval(timerInterval); }
        }
        tick();
      }
    }, 1000);
  });

  function tick() {
    const m = String(Math.floor(remaining/60)).padStart(2,'0');
    const s = String(remaining%60).padStart(2,'0');
    countdownEl.textContent = `${m}:${s}`;
  }

  pauseBtn.addEventListener('click', () => {
    if (!paused) {
      clearInterval(timerInterval);
      pauseBtn.textContent = 'Resume';
    } else {
      timerInterval = setInterval(() => {
        if (!paused) {
          remaining--;
          if (remaining < 0) {
            if (!inBreak) { inBreak=true; remaining=breakDur; }
            else          { clearInterval(timerInterval); }
          }
          tick();
        }
      },1000);
      pauseBtn.textContent = 'Pause Timer';
    }
    paused = !paused;
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(timerInterval);
    countdownEl.classList.add('hidden');
    clockEl.classList.remove('hidden');
    pauseBtn.classList.add('hidden');
    pauseBtn.textContent = 'Pause Timer';
    paused = false;
  });

});

<script src="https://cdnjs.cloudflare.com/ajax/libs/tilt.js/1.2.1/tilt.jquery.min.js"></script>
<script>
  VanillaTilt.init(document.querySelectorAll('.controls button'), {
    scale: 1.05,
    speed: 400
  });
</script>
