const cells = new GPU2D(document.getElementById("cells"), {
  antialias: false,
  preserveDrawingBuffer: true
})

const particleCount = 1000000

function uiSetup() {
  let ui = {
    trail: {
      followMouse: false
    },
    particles: {
      randomness: 1,
      sensorDistance: 55,
      moveSpeed: 0.001,
      turnSpeed: 0.125
    },
    diffuse: {
      decayRate: 0.1
    }
  }
  
  ui.trail = glProxy(ui.trail, trail)
  ui.particles = glProxy(ui.particles, particles)
  ui.diffuse = glProxy(ui.diffuse, diffuse)

  function glProxy(obj, prog) {
    const proxy = new Proxy(obj, {
      set(target, key, value) {
        const { gl } = cells
        target[key] = value

        gl.useProgram(prog.program)
        if (typeof target[key] === "boolean") {
          gl.uniform1i(prog.uniforms[key], target[key])
        } else {
          gl.uniform1f(prog.uniforms[key], target[key])
        }
      }
    })

    Object.keys(obj).forEach(key => {
      proxy[key] = obj[key]
    })

    return proxy
  }

  cells.canvas.addEventListener("mousemove", event => {
    if (!ui.trail.followMouse) { return }

    const { gl, canvas } = cells
    const rect = canvas.getBoundingClientRect()

    const x = (event.clientX - rect.left) / rect.width
    const y = 1 - (event.clientY - rect.top) / rect.height

    gl.useProgram(trail.program)
    gl.uniform2f(trail.uniforms.mousePos, x, y)
  })

  document.getElementById("followMouse").addEventListener("change", event => {
    ui.trail.followMouse = event.target.checked
  })

  uiSlider("randomness", ui.particles)
  uiSlider("sensorDistance", ui.particles)
  uiSlider("moveSpeed", ui.particles)
  // uiSlider("turnSpeed", ui.particles)
  uiSlider("decayRate", ui.diffuse)

  function uiSlider(name, obj, transform) {
    const el = document.getElementById(name)

    el.addEventListener("input", event => {
      let val = parseFloat(el.value)
      if (transform) { val = transform(val) }

      obj[name] = val
      updateDisplay()
    })

    const displayEl = el.parentElement.querySelector(".range-display")
    function updateDisplay() {
      if (displayEl) {
        const val = obj[name]
        let valStr = val
        if (val % 1 !== 0) {
          const leadingZeroes = Math.ceil(-Math.min(Math.log10(Math.abs(val)), 0))
          valStr = val.toFixed(leadingZeroes + 1)
        }

        displayEl.innerHTML = `(${valStr})`
      }
    }

    updateDisplay()
  }

  const angles = new Proxy({
    turnAngle: 45,
    sensorAngle: 45
  }, {
    set(target, key, value) {
      target[key] = value

      if (key === "turnAngle") {
        ui.particles.turnSpeed = value / 360
      } else if (key === "sensorAngle") {
        const { gl } = cells
        gl.useProgram(particles.program)

        const sin = Math.sin
        const cos = Math.cos
        const radians = value / 180 * Math.PI
        gl.uniformMatrix2fv(particles.uniforms.rotation, false, [
          cos(radians), -sin(radians),
          sin(radians), cos(radians)
        ])
        gl.uniformMatrix2fv(particles.uniforms.invRotation, false, [
          cos(-radians), -sin(-radians),
          sin(-radians), cos(-radians)
        ])
      }
    }
  })
  Object.keys(angles).forEach(key => angles[key] = angles[key])

  uiSlider("sensorAngle", angles)
  uiSlider("turnAngle", angles)
  // window.ui = ui
}



async function setup() {
  // await Promise.all([
  //   createParticleUpdateProgram(),
  //   createTrailUpdateProgram(),
  //   createTrailDiffuseProgram()
  // ])
  await createParticleUpdateProgram()
  await createTrailUpdateProgram()
  await createTrailDiffuseProgram()

  uiSetup()

  drawLoop()
}
window.addEventListener("load", setup)
// setup()

const particles = {
  program: null,
  framebuffer: null,
  texSize: {
    width: 0,
    height: 0
  },
  uniforms: {}
}
async function createParticleUpdateProgram() {
  const { gl, canvas } = cells

  const pixels = particleCount * 2
  const width = Math.min(pixels, canvas.width)
  const height = Math.ceil(pixels / canvas.width)
  particles.texSize = { width, height }

  const updateCode = await fetch("shaders/particleupdate.frag.cpp").then(res => res.text())
  const program = cells.create2dProgram(updateCode, false)

  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)

  const newParticleTex = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, newParticleTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, newParticleTex, 0)

  const initial = new Uint8Array(4 * width * height)
  for (let i = 0; i < particleCount; i++) {
    const offset = i * 8

    const x = Math.floor(Math.random() * 64) + 96
    const y = Math.floor(Math.random() * 64) + 96

    const dMiddleX = 128 - x
    const dMiddleY = 128 - y
    let direction = Math.random() // Math.atan2(dMiddleY, dMiddleX) / Math.PI
    // if (direction < 0.0) direction += 1

    initial[offset] = x
    initial[offset + 1] = Math.floor(Math.random() * 256)
    initial[offset + 2] = y
    initial[offset + 3] = Math.floor(Math.random() * 256)
    initial[offset + 4] = direction * 256 // Math.floor(Math.random() * 256)
    initial[offset + 5] = direction / 256 % 256 // Math.floor(Math.random() * 256)
  }

  const particleTex = gl.createTexture()
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, particleTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, initial)

  cells.useProgram(program)
  cells.setUniformValue("particles", (gl, p) => gl.uniform1i(p, 1))
  cells.setUniformValue("particleCount", (gl, p) => gl.uniform1f(p, particleCount))
  cells.setUniformValue("trails", (gl, p) => gl.uniform1i(p, 2))
  particles.uniforms.randomness = gl.getUniformLocation(program, "randomness")
  particles.uniforms.sensorDistance = gl.getUniformLocation(program, "sensorDistance")
  particles.uniforms.moveSpeed = gl.getUniformLocation(program, "moveSpeed")
  particles.uniforms.turnSpeed = gl.getUniformLocation(program, "turnSpeed")
  particles.uniforms.rotation = gl.getUniformLocation(program, "rotation")
  particles.uniforms.invRotation = gl.getUniformLocation(program, "invRotation")

  particles.program = program
  particles.framebuffer = framebuffer
}

function updateParticles() {
  const { gl } = cells
  const { width, height } = particles.texSize

  cells.useProgram(particles.program)

  const randomSeeds = [700_000 + Math.random() * 1000, 700_000 + Math.random() * 1000, Math.random()]
  cells.setUniformValue("randomSeed", (gl, p) => gl.uniform3fv(p, randomSeeds))

  gl.bindFramebuffer(gl.FRAMEBUFFER, particles.framebuffer)
  gl.viewport(0, 0, width, height)
  cells.draw(false)

  gl.activeTexture(gl.TEXTURE1)
  gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0)
}

const trail = {
  program: null,
  framebuffer: null,
  vertexBuffer: null,
  uniforms: {
    mousePos: null,
    followMouse: null
  }
}

async function createTrailUpdateProgram() {
  const { gl, canvas } = cells

  const program = gl.createProgram()
  const vs = gl.createShader(gl.VERTEX_SHADER)
  gl.shaderSource(vs, await fetch("shaders/trail.vert.cpp").then(res => res.text()))
  gl.attachShader(program, vs)
  gl.compileShader(vs)

  const fs = gl.createShader(gl.FRAGMENT_SHADER)
  gl.shaderSource(fs, await fetch("shaders/trail.frag.cpp").then(res => res.text()))
  gl.attachShader(program, fs)
  gl.compileShader(fs)

  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Failed to link trail program: ' + gl.getProgramInfoLog(program) + '\n\nVertex Shader: ' + gl.getShaderInfoLog(vs) + '\n\nFragment Shader: ' + gl.getShaderInfoLog(fs))
  }

  cells.useProgram(program)
  cells.setUniformValue("particles", (gl, p) => gl.uniform1i(p, 1))
  cells.setUniformValue("particleCount", (gl, p) => gl.uniform1f(p, particleCount))
  cells.setUniformValue("uViewSize", (gl, p) => gl.uniform2f(p, canvas.width, canvas.height))
  trail.uniforms.mousePos = gl.getUniformLocation(program, "mousePos")
  trail.uniforms.followMouse = gl.getUniformLocation(program, "followMouse")

  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)

  const trailTex = gl.createTexture()
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, trailTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, particleCount, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trailTex, 0)

  const vertexArray = new Float32Array(particleCount)
  for (let i = 0; i < particleCount; i++) {
    vertexArray[i] = i
  }
  const vertexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)

  const aVertexIndex = gl.getAttribLocation(program, "aVertexIndex")
  gl.enableVertexAttribArray(aVertexIndex)
  gl.vertexAttribPointer(aVertexIndex, 1, gl.FLOAT, false, 0, 0)

  trail.program = program
  trail.framebuffer = framebuffer
  trail.vertexBuffer = vertexBuffer
}

function drawTrail() {
  const { gl, canvas } = cells

  gl.useProgram(trail.program)

  gl.bindBuffer(gl.ARRAY_BUFFER, trail.vertexBuffer)

  const aVertexIndex = gl.getAttribLocation(trail.program, "aVertexIndex")
  gl.enableVertexAttribArray(aVertexIndex)
  gl.vertexAttribPointer(aVertexIndex, 1, gl.FLOAT, false, 0, 0)

  gl.bindFramebuffer(gl.FRAMEBUFFER, trail.framebuffer)
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.drawArrays(gl.POINTS, 0, particleCount)
}

const diffuse = {
  program: null,
  framebuffer: null,
  uniforms: {}
}
async function createTrailDiffuseProgram() {
  const { gl } = cells

  const diffuseCode = await fetch("shaders/diffuse.frag.cpp").then(res => res.text())
  const program = cells.create2dProgram(diffuseCode, false)

  cells.useProgram(program)
  cells.setUniformValue("trails", (gl, p) => gl.uniform1i(p, 2))
  diffuse.uniforms.decayRate = gl.getUniformLocation(program, "decayRate")

  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)

  const diffuseTex = gl.createTexture()
  gl.activeTexture(gl.TEXTURE3)
  gl.bindTexture(gl.TEXTURE_2D, diffuseTex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, particleCount, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, diffuseTex, 0)

  diffuse.program = program
  diffuse.framebuffer = framebuffer
}
function diffuseTrails() {
  const { gl, canvas } = cells
  const { width, height } = canvas

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  cells.useProgram(diffuse.program)
  cells.draw()

  gl.activeTexture(gl.TEXTURE2)
  gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0)
}

function drawLoop() {
  updateParticles()
  drawTrail()
  diffuseTrails()

  requestAnimationFrame(drawLoop)
}
