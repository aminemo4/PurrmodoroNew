 // Live clock updater
    setInterval(() => {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      document.getElementById('clock').textContent =
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }, 1000);

    const LiquidButton = class LiquidButton {
      constructor(svg) {
        const options = svg.dataset;
        this.id = this.constructor.id || (this.constructor.id = 1);
        this.constructor.id++;
        this.xmlns = 'http://www.w3.org/2000/svg';
        this.tension = options.tension * 1 || 0.4;
        this.width   = options.width   * 1 || 200;
        this.height  = options.height  * 1 ||  50;
        this.margin  = options.margin !== undefined 
                     ? Number(options.margin)
                     : 40;
        this.hoverFactor = options.hoverFactor || -0.1;
        this.gap     = options.gap     ||   5;
        this.debug   = options.debug   || false;
        this.forceFactor = options.forceFactor || 0.2;
        this.color1 = options.color1 || '#36DFE7';
        this.color2 = options.color2 || '#8F17E1';
        this.color3 = options.color3 || '#BF09E6';
        this.textColor = options.textColor || '#000000';
        this.text = options.text    || 'Button';
        this.svg = svg;
        this.layers = [{
          points: [],
          viscosity: 0.5,
          mouseForce: 100,
          forceLimit: 2,
        },{
          points: [],
          viscosity: 0.8,
          mouseForce: 150,
          forceLimit: 3,
        }];
        for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
          const layer = this.layers[layerIndex];
          layer.viscosity = options['layer-' + (layerIndex + 1) + 'Viscosity'] * 1 || layer.viscosity;
          layer.mouseForce = options['layer-' + (layerIndex + 1) + 'MouseForce'] * 1 || layer.mouseForce;
          layer.forceLimit = options['layer-' + (layerIndex + 1) + 'ForceLimit'] * 1 || layer.forceLimit;
          layer.path = document.createElementNS(this.xmlns, 'path');
          this.svg.appendChild(layer.path);
        }
        this.wrapperElement = options.wrapperElement || document.body;
        if (!this.svg.parentElement) {
          this.wrapperElement.append(this.svg);
        }

        this.svgText = document.createElementNS(this.xmlns, 'text');
        this.svgText.setAttribute('x', '50%');
        this.svgText.setAttribute('y', '50%');
        this.svgText.setAttribute('dy', ~~(this.height / 8) + 'px');
        this.svgText.setAttribute('font-size', ~~(this.height / 3));
        this.svgText.style.fontFamily = 'sans-serif';
        this.svgText.setAttribute('text-anchor', 'middle');
        this.svgText.setAttribute('pointer-events', 'none');
        this.svg.appendChild(this.svgText);

        this.svgDefs = document.createElementNS(this.xmlns, 'defs')
        this.svg.appendChild(this.svgDefs);

        this.touches = [];
        this.noise = options.noise || 0;
        document.body.addEventListener('touchstart', this.touchHandler);
        document.body.addEventListener('touchmove', this.touchHandler);
        document.body.addEventListener('touchend', this.clearHandler);
        document.body.addEventListener('touchcancel', this.clearHandler);
        this.svg.addEventListener('mousemove', this.mouseHandler);
        this.svg.addEventListener('mouseout', this.clearHandler);
        this.initOrigins();
        this.animate();
      }

      get mouseHandler() {
        return (e) => {
          this.touches = [{
            x: e.offsetX,
            y: e.offsetY,
            force: 1,
          }];
        };
      }

      get touchHandler() {
        return (e) => {
          this.touches = [];
          const rect = this.svg.getBoundingClientRect();
          for (let touchIndex = 0; touchIndex < e.changedTouches.length; touchIndex++) {
            const touch = e.changedTouches[touchIndex];
            const x = touch.pageX - rect.left;
            const y = touch.pageY - rect.top;
            if (x > 0 && y > 0 && x < this.svgWidth && y < this.svgHeight) {
              this.touches.push({x, y, force: touch.force || 1});
            }
          }
          e.preventDefault();
        };
      }

      get clearHandler() {
        return (e) => {
          this.touches = [];
        };
      }

      get raf() {
        return this.__raf || (this.__raf = (
          window.requestAnimationFrame ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame ||
          function(callback){ setTimeout(callback, 10)}
        ).bind(window));
      }

      distance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
      }

      update() {
        for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
          const layer = this.layers[layerIndex];
          const points = layer.points;
          for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
            const point = points[pointIndex];
            const dx = point.ox - point.x + (Math.random() - 0.5) * this.noise;
            const dy = point.oy - point.y + (Math.random() - 0.5) * this.noise;
            const d = Math.sqrt(dx * dx + dy * dy);
            const f = d * this.forceFactor;
            point.vx += f * ((dx / d) || 0);
            point.vy += f * ((dy / d) || 0);
            for (let touchIndex = 0; touchIndex < this.touches.length; touchIndex++) {
              const touch = this.touches[touchIndex];
              let mouseForce = layer.mouseForce;
              if (
                touch.x > this.margin &&
                touch.x < this.margin + this.width &&
                touch.y > this.margin &&
                touch.y < this.margin + this.height
              ) {
                mouseForce *= -this.hoverFactor;
              }
              const mx = point.x - touch.x;
              const my = point.y - touch.y;
              const md = Math.sqrt(mx * mx + my * my);
              const mf = Math.max(-layer.forceLimit, Math.min(layer.forceLimit, (mouseForce * touch.force) / md));
              point.vx += mf * ((mx / md) || 0);
              point.vy += mf * ((my / md) || 0);
            }
            point.vx *= layer.viscosity;
            point.vy *= layer.viscosity;
            point.x += point.vx;
            point.y += point.vy;
          }
          for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
            const prev = points[(pointIndex + points.length - 1) % points.length]; 
            const point = points[pointIndex];
            const next = points[(pointIndex + points.length + 1) % points.length];
            const dPrev = this.distance(point, prev);
            const dNext = this.distance(point, next);

            const line = {
              x: next.x - prev.x,
              y: next.y - prev.y,
            };
            const dLine = Math.sqrt(line.x * line.x + line.y * line.y);

            point.cPrev = {
              x: point.x - (line.x / dLine) * dPrev * this.tension,
              y: point.y - (line.y / dLine) * dPrev * this.tension,
            };
            point.cNext = {
              x: point.x + (line.x / dLine) * dNext * this.tension,
              y: point.y + (line.y / dLine) * dNext * this.tension,
            };
          }
        }
      }

      animate() {
        this.raf(() => {
          this.update();
          this.draw();
          this.animate();
        });
      }

      get svgWidth() {
        return this.width + this.margin * 2;
      }

      get svgHeight() {
        return this.height + this.margin * 2;
      }

      draw() {
        for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
          const layer = this.layers[layerIndex];
          if (layerIndex === 1) {
            if (this.touches.length > 0) {
              while (this.svgDefs.firstChild) {
                this.svgDefs.removeChild(this.svgDefs.firstChild);
              }
              for (let touchIndex = 0; touchIndex < this.touches.length; touchIndex++) {
                const touch = this.touches[touchIndex];
                const gradient = document.createElementNS(this.xmlns, 'radialGradient');
                gradient.id = 'liquid-gradient-' + this.id + '-' + touchIndex;
                const start = document.createElementNS(this.xmlns, 'stop');
                start.setAttribute('stop-color', this.color3);
                start.setAttribute('offset', '0%');
                const stop = document.createElementNS(this.xmlns, 'stop');
                stop.setAttribute('stop-color', this.color2);
                stop.setAttribute('offset', '100%');
                gradient.appendChild(start);
                gradient.appendChild(stop);
                this.svgDefs.appendChild(gradient);
                gradient.setAttribute('cx', touch.x / this.svgWidth);
                gradient.setAttribute('cy', touch.y / this.svgHeight);
                gradient.setAttribute('r', touch.force);
                layer.path.style.fill = 'url(#' + gradient.id + ')';
              }
            } else {
              layer.path.style.fill = this.color2;
            }
          } else {
            layer.path.style.fill = this.color1;
          }
          const points = layer.points;
          const commands = [];
          commands.push('M', points[0].x, points[0].y);
          for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
            commands.push('C',
              points[(pointIndex + 0) % points.length].cNext.x,
              points[(pointIndex + 0) % points.length].cNext.y,
              points[(pointIndex + 1) % points.length].cPrev.x,
              points[(pointIndex + 1) % points.length].cPrev.y,
              points[(pointIndex + 1) % points.length].x,
              points[(pointIndex + 1) % points.length].y
            );
          }
          commands.push('Z');
          layer.path.setAttribute('d', commands.join(' '));
        }
        this.svgText.textContent = this.text;
        this.svgText.style.fill = this.textColor;
      }

      createPoint(x, y) {
        return {
          x: x,
          y: y,
          ox: x,
          oy: y,
          vx: 0,
          vy: 0,
        };
      }

      initOrigins() {
        this.svg.setAttribute('width', this.svgWidth);
        this.svg.setAttribute('height', this.svgHeight);
        for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
          const layer = this.layers[layerIndex];
          const points = [];
          for (let x = ~~(this.height / 2); x < this.width - ~~(this.height / 2); x += this.gap) {
            points.push(this.createPoint(
              x + this.margin,
              this.margin
            ));
          }
          for (let alpha = ~~(this.height * 1.25); alpha >= 0; alpha -= this.gap) {
            const angle = (Math.PI / ~~(this.height * 1.25)) * alpha;
            points.push(this.createPoint(
              Math.sin(angle) * this.height / 2 + this.margin + this.width - this.height / 2,
              Math.cos(angle) * this.height / 2 + this.margin + this.height / 2
            ));
          }
          for (let x = this.width - ~~(this.height / 2) - 1; x >= ~~(this.height / 2); x -= this.gap) {
            points.push(this.createPoint(
              x + this.margin,
              this.margin + this.height
            ));
          }
          for (let alpha = 0; alpha <= ~~(this.height * 1.25); alpha += this.gap) {
            const angle = (Math.PI / ~~(this.height * 1.25)) * alpha;
            points.push(this.createPoint(
              (this.height - Math.sin(angle) * this.height / 2) + this.margin - this.height / 2,
              Math.cos(angle) * this.height / 2 + this.margin + this.height / 2
            ));
          }
          layer.points = points;
        }
      }
    }

    function loadMusic(inputId = 'music-source') {
      const url = document.getElementById(inputId).value.trim();
      const player = document.getElementById('player');
      player.innerHTML = '';

      // YouTube?
        const ytMatch = url.match(
        /(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]{11})/
        );


      if (ytMatch) {
        const videoId = ytMatch[1];
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.style.cssText = 'width:100%;max-width:560px;height:315px;border:none';
        player.appendChild(iframe);

        // Hide initial controls and show two-column layout
        document.getElementById('initial-controls').classList.add('hidden');
        document.querySelector('.main-container').classList.add('loaded');
        
        // Copy URL to second input if it was the first one
        if (inputId === 'music-source') {
          document.getElementById('music-source-2').value = url;
        }
        return;
      }

      // Spotify?
      const spMatch = url.match(
        /open\.spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]+)/
      );
      if (spMatch) {
        const [, type, id] = spMatch;
        const iframe = document.createElement('iframe');
        iframe.src = `https://open.spotify.com/embed/${type}/${id}`;
        iframe.allow = 'encrypted-media';
        iframe.style.cssText = `width:100%;max-width:500px;height:${type==='track'?'80px':'380px'};border:none`;
        player.appendChild(iframe);

        // Hide initial controls and show two-column layout
        document.getElementById('initial-controls').classList.add('hidden');
        document.querySelector('.main-container').classList.add('loaded');
        
        // Copy URL to second input if it was the first one
        if (inputId === 'music-source') {
          document.getElementById('music-source-2').value = url;
        }
        return;
      }

      // Neither matched
      alert('Please enter a valid YouTube or Spotify URL.');
    }

    function setTimer() {
  const minutes = prompt('⏱️ Set Focus Timer\n\nHow many minutes would you like to focus?', '25');
  if (minutes && !isNaN(minutes) && minutes > 0) {
    const seconds = parseInt(minutes) * 60;
    startCountdown(seconds);
  }
}

function showTimerModal() {
  // Create modal HTML
  const modalHTML = `
    <div class="timer-modal" id="timer-modal">
      <div class="timer-dialog">
        <h3>Set Timer</h3>
        <p>How many minutes would you like to focus?</p>
        <input type="number" class="timer-input" id="timer-input" value="25" min="1" max="180">
        <div class="timer-buttons">
          <button class="timer-btn secondary" onclick="closeTimerModal()">Cancel</button>
          <button class="timer-btn primary" onclick="confirmTimer()">Start Timer</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Show modal with animation
  setTimeout(() => {
    document.getElementById('timer-modal').classList.add('show');
  }, 10);
  
  // Focus input and select text
  const input = document.getElementById('timer-input');
  input.focus();
  input.select();
  
  // Handle Enter key
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmTimer();
    }
  });
}

function closeTimerModal() {
  const modal = document.getElementById('timer-modal');
  modal.classList.remove('show');
  setTimeout(() => {
    modal.remove();
  }, 300);
}

function confirmTimer() {
  const minutes = document.getElementById('timer-input').value;
  if (minutes && !isNaN(minutes) && minutes > 0) {
    const seconds = parseInt(minutes) * 60;
    closeTimerModal();
    startCountdown(seconds);
  }
}

  function resetTimer() {
  const countdown = document.getElementById('countdown');
  const clock = document.getElementById('clock');
  const timerLabel = document.getElementById('timer-label');
  
  // Hide countdown, timer label, and restore clock size
  countdown.classList.add('hidden');
  countdown.textContent = '';
  clock.classList.remove('timer-active');
  timerLabel.classList.remove('active');
  
  if (window.countdownInterval) {
    clearInterval(window.countdownInterval);
  }
}
  function startCountdown(seconds) {
  const countdown = document.getElementById('countdown');
  const clock = document.getElementById('clock');
  const timerLabel = document.getElementById('timer-label');
  
  // Show countdown, timer label, and make clock smaller
  countdown.classList.remove('hidden');
  clock.classList.add('timer-active');
  timerLabel.classList.add('active');
  
  // Auto-scroll to timer - ADD THIS LINE
  countdown.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  if (window.countdownInterval) {
    clearInterval(window.countdownInterval);
  }
  
  window.countdownInterval = setInterval(() => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const pad = n => String(n).padStart(2, '0');
    countdown.textContent = `${pad(minutes)}:${pad(secs)}`; // Removed "Timer:" prefix
    
    if (seconds <= 0) {
      clearInterval(window.countdownInterval);
      countdown.textContent = 'Time\'s up!';
      alert('Timer finished!');
    } else {
      seconds--;
    }
  }, 1000);
}

    document.addEventListener('DOMContentLoaded', () => {
      // Initialize all liquid buttons with a small consdelay to ensure DOM is ready
      setTimeout(() => {
        console.log('Initializing liquid buttons...');
        document.querySelectorAll('.liquid-button').forEach((svg, index) => {
          console.log(`Initializing button ${index + 1}:`, svg);
          try {
            new LiquidButton(svg);
            console.log(`Button ${index + 1} initialized successfully`);
          } catch (error) {
            console.error(`Error initializing button ${index + 1}:`, error);
          }
        });
      }, 100);

      // Event listeners for initial controls
      document.getElementById('load-music-btn').addEventListener('click', () => loadMusic('music-source'));
      document.getElementById('set-timer-btn').addEventListener('click', setTimer);
      document.getElementById('reset-btn').addEventListener('click', resetTimer);

      // Event listeners for two-column layout controls
      document.getElementById('load-music-btn-2').addEventListener('click', () => loadMusic('music-source-2'));
      document.getElementById('set-timer-btn-2').addEventListener('click', setTimer);
      document.getElementById('reset-btn-2').addEventListener('click', resetTimer);

      // Allow Enter key to trigger play button
      document.getElementById('music-source').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          loadMusic('music-source');
        }
      });
      
      document.getElementById('music-source-2').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          loadMusic('music-source-2');
        }
      });
    });

    // WebGL Background Effect
function initWebGLBackground() {
  const canvas = document.getElementById('webgl-canvas'); // Changed from querySelector
  const gl = canvas.getContext("webgl");
  if (!gl) {
    console.error("WebGL not supported");
    return;
  }

  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    gl.viewport(0, 0, width, height);
  }
  window.addEventListener("resize", resizeCanvas);

  let mouse = { x: width / 2, y: height / 2 };
  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  window.addEventListener("mousemove", onMouseMove);

  const circleColors = [
    [18 / 255, 113 / 255, 1.0],
    [221 / 255, 74 / 255, 1.0],
    [100 / 255, 220 / 255, 1.0],
    [200 / 255, 50 / 255, 50 / 255],
    [180 / 255, 180 / 255, 50 / 255],
    [140 / 255, 100 / 255, 1.0],
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
      circles.push({
        x, y, radius,
        color: circleColors[i],
        vx, vy,
        interactive: false,
      });
    }

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
uniform bool u_darkMode;
uniform int u_circleCount;
uniform vec3 u_circlesColor[6];
uniform vec3 u_circlesPosRad[6];
uniform vec2 u_mouse;

void main(void) {
    vec2 st = v_uv * u_resolution;
    vec3 topColor = vec3(240.0/255.0, 216.0/255.0, 244.0/255.0);
    vec3 bottomColor = vec3(0.0, 17.0/255.0, 82.0/255.0);
    vec3 bgColor = mix(topColor, bottomColor, st.y / u_resolution.y);

    float fieldSum = 0.0;
    vec3 weightedColorSum = vec3(0.0);
    
    for (int i = 0; i < 6; i++) {
        if (i >= u_circleCount) { break; }
        vec3 posRad = u_circlesPosRad[i];
        vec2 cPos = vec2(posRad.r, posRad.g);
        float radius = posRad.b;
        float dist = length(st - cPos);
        float sigma = radius * 0.5;
        float val = exp(- (dist * dist) / (2.0 * sigma * sigma));
        fieldSum += val;
        weightedColorSum += u_circlesColor[i] * val;
    }

    vec3 finalCirclesColor = vec3(0.0);
    if (fieldSum > 0.0) {
      finalCirclesColor = weightedColorSum / fieldSum;
    }

    float intensity = pow(fieldSum, 1.4);
    vec3 finalColor = mix(bgColor, finalCirclesColor, clamp(intensity, 0.0, 1.0));
    gl_FragColor = vec4(finalColor, 1.0);
}
  `;

  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
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
    console.error("Program link error:", gl.getProgramInfoLog(program));
  }

  gl.useProgram(program);

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const a_position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(a_position);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

  const u_resolution = gl.getUniformLocation(program, "u_resolution");
  const u_circleCount = gl.getUniformLocation(program, "u_circleCount");
  const u_circlesColor = gl.getUniformLocation(program, "u_circlesColor");
  const u_circlesPosRad = gl.getUniformLocation(program, "u_circlesPosRad");
  const u_mouse = gl.getUniformLocation(program, "u_mouse");

  gl.uniform2f(u_resolution, width, height);

  function updateCircles() {
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      if (!c.interactive) {
        c.x += c.vx;
        c.y += c.vy;
        if (c.x - c.radius > width) c.x = -c.radius;
        if (c.x + c.radius < 0) c.x = width + c.radius;
        if (c.y - c.radius > height) c.y = -c.radius;
        if (c.y + c.radius < 0) c.y = height + c.radius;
      } else {
        c.x += (mouse.x - c.x) * 0.1;
        c.y += (mouse.y - c.y) * 0.1;
      }
    }
  }

  function render() {
    updateCircles();
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    gl.uniform1i(u_circleCount, circles.length);
    gl.uniform2f(u_resolution, width, height);
    gl.uniform2f(u_mouse, mouse.x, mouse.y);

    let colorsArr = [];
    let posRadArr = [];
    for (let i = 0; i < 6; i++) {
      if (i < circles.length) {
        const c = circles[i];
        colorsArr.push(c.color[0], c.color[1], c.color[2]);
        posRadArr.push(c.x, c.y, c.radius);
      } else {
        colorsArr.push(0, 0, 0);
        posRadArr.push(0, 0, 0);
      }
    }

    gl.uniform3fv(u_circlesColor, new Float32Array(colorsArr));
    gl.uniform3fv(u_circlesPosRad, new Float32Array(posRadArr));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  render();
}

// Initialize WebGL background when page loads
window.addEventListener('load', initWebGLBackground);