const cells = new GPU2D(document.getElementById("cells"), {
  antialias: false,
  preserveDrawingBuffer: true
})

let particleCount = JSON.parse(localStorage.getItem("particleCount")) || 200000

const ui = {
  trail: {
    followMouse: false,

    color: 0,
    colorOffset: 0,
  },
  particles: {
    randomness: 1,
    sensorDistance: 0.02,
    moveSpeed: 0.001
  },
  diffuse: {
    decayRate: 0.1
  },
  angles: {
    turnAngle: 45,
    sensorAngle: 45
  },

  other: {
    gifLength: 3,
    particleCount,
    canvasSize: cells.canvas.width
  },
  /** @type { Record<string, UISlider> } */
  sliders: null
}

function uiSetup() {
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

        updateUrl()
        return true
      }
    })

    Object.keys(obj).forEach(key => {
      proxy[key] = obj[key]
    })

    return proxy
  }

  ui.trail = glProxy(ui.trail, trail)
  ui.particles = glProxy(ui.particles, particles)
  ui.diffuse = glProxy(ui.diffuse, diffuse)
  ui.angles = new Proxy(ui.angles, {
    set(target, key, value) {
      const { gl } = cells

      target[key] = value

      if (key === "turnAngle") {
        gl.useProgram(particles.program)
        gl.uniform1f(particles.uniforms.turnSpeed, value / 360)
      } else if (key === "sensorAngle") {
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

      updateUrl()
      return true
    }
  })
  Object.keys(ui.angles).forEach(key => ui.angles[key] = ui.angles[key])

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

  ui.sliders = {
    randomness: new UISlider("randomness", ui.particles),
    sensorDistance: new UISlider("sensorDistance", ui.particles),
    moveSpeed: new UISlider("moveSpeed", ui.particles),
    decayRate: new UISlider("decayRate", ui.diffuse),
    sensorAngle: new UISlider("sensorAngle", ui.angles),
    turnAngle: new UISlider("turnAngle", ui.angles),
    color: new UISlider("color", ui.trail),
    colorOffset: new UISlider("colorOffset", ui.trail),
    gifLength: new UISlider("gifLength", ui.other),
    particleCount: new UISlider("particleCount", ui.other),
    canvasSize: new UISlider("canvasSize", ui.other)
  }

  document.getElementById("restart").addEventListener("click", () => {
    cells.canvas.width = ui.other.canvasSize
    cells.canvas.height = ui.other.canvasSize
    particleCount = ui.other.particleCount
    resetTrailAndParticles()

    updateUrl()
    localStorage.setItem("particleCount", particleCount)
  })
  if (ui.other.canvasSize !== cells.canvas.width) {
    cells.canvas.width = ui.other.canvasSize
    cells.canvas.height = ui.other.canvasSize
    resetTrailAndParticles()
  }

  const downloadEl = document.getElementById("download")
  document.getElementById("screenshot").addEventListener("click", event => {
    cells.canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      downloadEl.href = url
      downloadEl.download = "physarum.jpg"
      downloadEl.click()
    }, "image/jpeg")
  })
}

class UISlider {
  constructor(name, obj, transform) {
    const el = document.getElementById(name)

    el.addEventListener("input", event => {
      let val = parseFloat(el.value)
      if (transform) { val = transform(val)} 

      obj[name] = val
      this.update(true)
    })

    this.name = name
    this.obj = obj
    this.el = el

    this.update()
  }

  update(fromInput = false) {
    const { name, obj, el } = this

    const displayEl = el.parentElement.querySelector(".range-display")

    if (displayEl) {
      const val = obj[name]
      let valStr = val.toLocaleString()
      if (val % 1 !== 0) {
        const leadingZeroes = Math.ceil(-Math.min(Math.log10(Math.abs(val % 1)), 0))
        valStr = val.toLocaleString(undefined, { minimumFractionDigits: leadingZeroes, maximumFractionDigits: leadingZeroes + 2 })
      }

      displayEl.innerHTML = `(${valStr})`
    }

    if (!fromInput) {
      el.value = obj[name]
    }
  }
}

function randomizeParameters() {
  ui.particles.sensorDistance = Math.floor(Math.random() * 100) / 1000 + 0.001
  ui.angles.sensorAngle = Math.floor(Math.random() * 85) + 5
  ui.angles.turnAngle = Math.floor(Math.random() * 85) + 5
  ui.trail.color = Math.floor(Math.random() * 3)
  ui.trail.colorOffset = Math.random()

  if (ui.sliders) {
    ui.sliders.sensorDistance.update()
    ui.sliders.sensorAngle.update()
    ui.sliders.turnAngle.update()
    ui.sliders.color.update()
    ui.sliders.colorOffset.update()
  }
}
randomizeParameters()
document.getElementById("randomize").addEventListener("click", randomizeParameters)

function exportParameters() {
  const parameters = {}

  Object.keys(ui).forEach(key => {
    if (key == "sliders") { return }

    const params = ui[key]
    Object.keys(params).forEach(key => {
      parameters[key] = params[key]
    })
  })

  delete parameters.particleCount
  delete parameters.gifLength

  return parameters
}
document.getElementById("copy-parameters").addEventListener("click", event => {
  const el = document.getElementById("copy-url")

  const url = location.protocol + "//" + location.host + location.pathname
  
  const params = exportParameters()
  const paramValues = []
  Object.keys(params).forEach(key => {
    if (key == "canvasSize") { return }

    paramValues.push(`${key}=${params[key]}`)
  })

  el.value = url + "#" + paramValues.join("&")
  el.select()
  document.execCommand("copy")
})
function updateUrl() {
  const params = exportParameters()
  const paramValues = []
  Object.keys(params).forEach(key => {
    paramValues.push(`${key}=${params[key]}`)
  })

  location.hash = paramValues.join("&")
}

let paramObjects
function importParameters(parameters) {
  if (!paramObjects) {
    paramObjects = {}

    Object.keys(ui).forEach(key => {
      if (key == "sliders") { return }

      const params = ui[key]
      Object.keys(params).forEach(key => {
        paramObjects[key] = params
      })
    })
  }

  Object.keys(parameters).forEach(key => {
    const params = paramObjects[key]
    if (params) {
      params[key] = parameters[key]
    }
  })

  if (!ui.sliders) return
  Object.keys(ui.sliders).forEach(key => {
    ui.sliders[key].update()
  })
}
if (location.hash) {
  const hash = location.hash

  let params = {}
  try {
    const json = decodeURIComponent(hash.slice(1))
    params = JSON.parse(json)
  } catch (err) {
    hash.slice(1).split("&").forEach(param => {
      const [key, value] = param.split("=")
      
      try {
        params[key] = JSON.parse(value)
      } catch (err) {
        params[key] = value
      }
    })
  }

  if (params.sensorDistance > 1) {
    params.sensorDistance /= 2048
  }
  importParameters(params)
}

let initialSetup = true
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

  if (initialSetup) {
    initialSetup = false

    drawLoop()
  }
}
window.addEventListener("load", setup)

const particles = {
  program: null,
  framebuffer: null,
  texture: null,
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
  particles.texture = particleTex
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
  texture: null,
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
  trail.uniforms.color = gl.getUniformLocation(program, "color")
  trail.uniforms.colorOffset = gl.getUniformLocation(program, "colorOffset")

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
  trail.texture = trailTex
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

let gif, gifPromise
let remainingGifFrames = -1
function recordGif(frames) {
  const { width, height } = cells.canvas

  gif = new GIF({
    width: width,
    height: height,
    quality: 10,
    workerScript: "gifjs/gif.worker.js",
    background: "#000"
  })
  remainingGifFrames = frames

  gifButton.disabled = true
  gifButton.innerText = "Recording..."
}
const gifButton = document.getElementById("record-gif")
gifButton.addEventListener("click", () => recordGif(ui.other.gifLength * 20))

function drawLoop() {
  updateParticles()
  drawTrail()
  diffuseTrails()

  if (remainingGifFrames > 0) {
    remainingGifFrames -= 1

    const promise = new Promise(resolve => {
      cells.canvas.toBlob(blob => {
        const img = new Image(512, 512)
        img.src = URL.createObjectURL(blob)

        img.onload = () => {
          gif.addFrame(img, { delay: 50 })
          resolve()
        }
      }, "image/jpeg")
    })

    if (gifPromise) {
      gifPromise = gifPromise.then(() => promise)
    } else {
      gifPromise = promise
    }
  } else if (remainingGifFrames === 0) {
    gif.on("finished", blob => {
      console.log(blob)

      const url = URL.createObjectURL(blob)
      const downloadEl = document.getElementById("download")
      downloadEl.href = url
      downloadEl.download = "physarum.gif"
      downloadEl.click()

      gifButton.disabled = false
      gifButton.innerText = "Record GIF"
    })

    gifPromise.then(() => {
      gifButton.innerText = "Processing..."
      gif.render()
    })

    remainingGifFrames = -1
  }

  requestAnimationFrame(drawLoop)
}

function resetTrailAndParticles() {
  const { gl, canvas } = cells

  cells.useProgram(trail.program)
  cells.setUniformValue("uViewSize", (gl, p) => gl.uniform2f(p, canvas.width, canvas.height))

  cells.useProgram(particles.program)
  cells.setUniformValue("particleCount", (gl, p) => gl.uniform1f(p, particleCount))

  gl.bindFramebuffer(gl.FRAMEBUFFER, trail.framebuffer)
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  const vertexArray = new Float32Array(particleCount)
  for (let i = 0; i < particleCount; i++) {
    vertexArray[i] = i
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, trail.vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)

  const pixels = particleCount * 2
  const width = Math.min(pixels, canvas.width)
  const height = Math.ceil(pixels / canvas.width)
  particles.texSize = { width, height }

  const initial = new Uint8Array(4 * width * height)
  for (let i = 0; i < particleCount; i++) {
    const offset = i * 8

    const x = Math.floor(Math.random() * 64) + 96
    const y = Math.floor(Math.random() * 64) + 96

    let direction = Math.random()

    initial[offset] = x
    initial[offset + 1] = Math.floor(Math.random() * 256)
    initial[offset + 2] = y
    initial[offset + 3] = Math.floor(Math.random() * 256)
    initial[offset + 4] = direction * 256
    initial[offset + 5] = direction / 256 % 256
  }

  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, particles.texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, initial)
}