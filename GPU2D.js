class GPU2D {
  /**
   * @param { HTMLCanvasElement } canvas
   * @param { WebGLContextAttributes } options
   */
  constructor(canvas, options) {
    this.canvas = canvas
    const gl = this.gl = canvas.getContext("webgl", options)
    // this.program = gl.createProgram()

    // this._attachVertexShader()

    const vertexArray = new Float32Array([ -3, 1, 1, 1, 1, -3 ])
    const vertexBuffer = this.vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)
  }

  _attachVertexShader(program) {
    const { gl } = this

    const code = `
precision highp float;

attribute vec2 aVertexPosition;

void main() {
  gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}`
    const shader = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(shader, code)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error("Error compiling vertex shader:\n\n" + gl.getShaderInfoLog(shader))
    }

    gl.attachShader(program, shader)
  }

  draw(autoViewport = true) {
    const { gl, program, canvas } = this

    if (autoViewport) gl.viewport(0, 0, canvas.width, canvas.height)

    const uViewSize = gl.getUniformLocation(program, "uViewSize")
    gl.uniform2fv(uViewSize, [canvas.width, canvas.height])
    

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)

    const aVertexPosition = gl.getAttribLocation(program, "aVertexPosition")
    gl.enableVertexAttribArray(aVertexPosition)
    gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0)

    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /**
   * @param { string } name
   * @param { (gl: WebGLRenderingContext, location: WebGLUniformLocation) => void } setValue
   */
  setUniformValue(name, setValue) {
    const { gl, program } = this

    if (!this.uniforms) {
      /** @type { Map<WebGLProgram, Map<string, WebGLUniformLocation>> } */
      this.uniforms = new Map()
    }
    let programUniforms = this.uniforms.get(program)
    if (!programUniforms) {
      programUniforms = new Map()
      this.uniforms.set(program, programUniforms)
    }

    let location
    if (!programUniforms.has(name)) {
      location = gl.getUniformLocation(program, name)
      programUniforms.set(name, location)
    } else {
      location = programUniforms.get(name)
    }
    
    setValue(gl, location)
    return location
  }

  /**
   * @param { string } pixelShaderCode must include `vec4 pixel(float x, float y, float screenX, float screenY)`
   */
  create2dProgram(pixelShaderCode, computeGrid = true) {
    const { gl } = this

    const program = gl.createProgram()
    this._attachVertexShader(program)

    const mainSimple = `gl_FragColor = pixel(gl_FragCoord.x, gl_FragCoord.y);`
    const mainGrid = `
  float normX = gl_FragCoord.x / uViewSize.x;
  float normY = 1.0 - gl_FragCoord.y / uViewSize.y;

  float x = 2.0 * normX - 1.0;
  float y = 2.0 * normY - 1.0;

  if (uViewSize.x > uViewSize.y) {
    x *= uViewSize.x / uViewSize.y;
  } else {
    y *= uViewSize.y / uViewSize.x;
  }

  gl_FragColor = pixel(x, y, normX, normY);
`
    
    const code = `
precision highp float;

uniform vec2 uViewSize;

${pixelShaderCode}

void main() {
${ computeGrid ? mainGrid : mainSimple }
}`
    const shader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(shader, code)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error("Error compiling fragment shader:\n\n" + gl.getShaderInfoLog(shader))
    }

    gl.attachShader(program, shader)

    gl.linkProgram(program)

    if ( !gl.getProgramParameter( program, gl.LINK_STATUS) ) {
      throw new Error("Error compiling program:\n\n" + gl.getProgramInfoLog(program))
    }

    gl.useProgram(program)

    const aVertexPosition = gl.getAttribLocation(program, "aVertexPosition")
    gl.enableVertexAttribArray(aVertexPosition)
    gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0)

    return program
  }

  /**
   * @param { WebGLProgram } program 
   */
  useProgram(program) {
    this.gl.useProgram(program)
    this.program = program
  }
}
