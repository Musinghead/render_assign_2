//============================================================================
// GROUP NUMBER: 1
//
// STUDENT NAME: Hu Qihai
// NUS User ID.: t0918554
//
// STUDENT NAME: Bi Hanqi
// NUS User ID.: t0918612
//
// STUDENT NAME: Kuang Zhiyi
// NUS User ID.: t0918062
//
// COMMENTS TO GRADER: 
//
//============================================================================

// FRAGMENT SHADER

#version 430 core

//============================================================================
// Received from rasterizer.
//============================================================================
in vec3 ecPosition;   // Fragment's 3D position in eye space.
in vec3 ecNormal;     // Fragment's normal vector in eye space.
in vec3 v2fTexCoord;  // Fragment's texture coordinates. It is 3D when it is 
                      //   used as texture coordinates to a cubemap.


//============================================================================
// Indicates which object is being rendered.
// 0 -- draw skybox, 1 -- draw brick cube, 2 -- draw wooden cube.
//============================================================================
uniform int WhichObj;  


//============================================================================
// View and projection matrices, etc.
//============================================================================
uniform mat4 ViewMatrix;          // View transformation matrix.
uniform mat4 ModelViewMatrix;     // ModelView matrix.
uniform mat4 ModelViewProjMatrix; // ModelView matrix * Projection matrix.
uniform mat3 NormalMatrix;        // For transforming object-space direction 
                                  //   vector to eye space.

//============================================================================
// Light info.
//============================================================================
uniform vec4 LightPosition; // Given in eye space. Can be directional.
uniform vec4 LightAmbient; 
uniform vec4 LightDiffuse;
uniform vec4 LightSpecular;

// Material shininess for specular reflection.
const float MatlShininess = 128.0;


//============================================================================
// Environment cubemap used for skybox and reflection mapping.
//============================================================================
layout (binding = 0) uniform samplerCube EnvMap;

//============================================================================
// The brick texture map whose color is used as the ambient and diffuse 
// material in the lighting computation.
//============================================================================
layout (binding = 1) uniform sampler2D BrickDiffuseMap;

//============================================================================
// The brick normal map whose color is used as perturbed normal vector
// in the tangent space.
//============================================================================
layout (binding = 2) uniform sampler2D BrickNormalMap;

//============================================================================
// The wood texture map whose color is used as the ambient and diffuse 
// material in the lighting computation.
//============================================================================
layout (binding = 3) uniform sampler2D WoodDiffuseMap;


//============================================================================
// MirrorTileDensity defines the number of hemispherical mirrors across each 
// dimension when the corresponding texture coordinate ranges from 0.0 to 1.0.
//============================================================================
const float MirrorTileDensity = 2.0;  // (0.0, inf)


//============================================================================
// MirrorRadius is the radius of the hemispherical mirror in each tile. 
// The radius is relative to the tile size, which is considered to be 1.0 x 1.0.
//============================================================================
const float MirrorRadius = 0.4;  // (0.0, 0.5]


//============================================================================
// DeltaNormal_Z_Scale is used to exaggerate the height of bump when doing
// normal mapping. The z component of the decoded perturbed normal vector 
// read from the normal map is multiplied by DeltaNormal_Z_Adj.
//============================================================================
const float DeltaNormal_Z_Scale = 1.0 / 5.0;


//============================================================================
// Output to color buffer.
//============================================================================
layout (location = 0) out vec4 FragColor;



/////////////////////////////////////////////////////////////////////////////
// Compute fragment color on skybox.
/////////////////////////////////////////////////////////////////////////////
void drawSkybox() 
{
    FragColor = texture(EnvMap, v2fTexCoord);
}



/////////////////////////////////////////////////////////////////////////////
// Compute the Tangent vector T and the Binormal vector B, given the
// Normal vector N, a 3D position p, and 2D texture coordinates uv.
// Note that T, B, N and p are all in the same coordinate space.
/////////////////////////////////////////////////////////////////////////////
void compute_tangent_vectors( vec3 N, vec3 p, vec2 uv, out vec3 T, out vec3 B )
{
    // Please refer to "Followup: Normal Mapping Without Precomputed Tangents" at
    // http://www.thetenthplanet.de/archives/1180

    // get edge vectors of the pixel triangle
    vec3 dp1 = dFdx( p );
    vec3 dp2 = dFdy( p );
    vec2 duv1 = dFdx( uv );
    vec2 duv2 = dFdy( uv );
 
    // solve the linear system
    vec3 dp2perp = cross( dp2, N );
    vec3 dp1perp = cross( N, dp1 );
    T = normalize( dp2perp * duv1.x + dp1perp * duv2.x );  // Tangent vector
    B = normalize( dp2perp * duv1.y + dp1perp * duv2.y );  // Binormal vector
}



/////////////////////////////////////////////////////////////////////////////
// Compute fragment color on brick cube.
/////////////////////////////////////////////////////////////////////////////
void drawBrickCube()
{
    if (gl_FrontFacing) {
        vec3 viewVec = -normalize(ecPosition);
        vec3 necNormal = normalize(ecNormal);

        vec3 lightVec;
        if (LightPosition.w == 0.0 )
            lightVec = normalize(LightPosition.xyz);
        else
            lightVec = normalize(LightPosition.xyz - ecPosition);

        /////////////////////////////////////////////////////////////////////////////
        // TASK 2:
        // * Construct eye-space Tangent and Binormal vectors.
        // * Read and decode tangent-space perturbation vector from normal map.
        // * Transform perturbation vector to eye space.
        // * Use eye-space perturbation vector as normal vector in lighting
        //   computation using Phong Reflection Model.
        // * Write computed fragment color to FragColor.
        /////////////////////////////////////////////////////////////////////////////
        
        // construct tangent and binormal vectors in eye space
        vec3 ecTangent;
        vec3 ecBinormal;
        compute_tangent_vectors(necNormal, ecPosition, v2fTexCoord.xy, ecTangent, ecBinormal);
        // transform normal vector to [-1, 1]
        vec3 tanBrickNormalValue_01 = texture(BrickNormalMap, v2fTexCoord.xy).rgb;
        // n11: negative 1 to 1
        vec3 tanBrickNormalValue_n11 = tanBrickNormalValue_01 * 2.0 - 1.0;
        // exaggerate the height of bump
        tanBrickNormalValue_n11.z *= DeltaNormal_Z_Scale;
        tanBrickNormalValue_n11 = normalize(tanBrickNormalValue_n11);
        // get diffuse and ambient color
        vec3 diffuseColor = texture(BrickDiffuseMap, v2fTexCoord.xy).rgb;
        // transform perturbation vector to eye space
        vec3 ecBrickNormal = tanBrickNormalValue_n11.x * ecTangent +
                             tanBrickNormalValue_n11.y * ecBinormal +
                             tanBrickNormalValue_n11.z * necNormal;
        // diffuse
        float N_dot_L = max(dot(ecBrickNormal, lightVec), 0.0);
        // specular
        vec3 reflectVec = reflect(-lightVec, ecBrickNormal);
        float R_dot_V = max(dot(reflectVec, viewVec), 0.0);
        float spec = (R_dot_V == 0.0) ? 0.0 : pow(R_dot_V, MatlShininess);
        // assemble
        vec3 tempColor = LightAmbient.rgb * diffuseColor + 
                         LightDiffuse.rgb * diffuseColor * N_dot_L + 
                         LightSpecular.rgb * spec;
        ///////////////////////////////////
        // TASK 2: WRITE YOUR CODE HERE. //
        ///////////////////////////////////

        FragColor = vec4(tempColor, 1.0);  // Replace this with your code.
    }
    else discard;
}



/////////////////////////////////////////////////////////////////////////////
// Compute fragment color on wooden cube.
/////////////////////////////////////////////////////////////////////////////
void drawWoodenCube()
{
    if (gl_FrontFacing) {
        vec3 viewVec = -normalize(ecPosition);
        vec3 necNormal = normalize(ecNormal);

        vec3 lightVec;
        if (LightPosition.w == 0.0 )
            lightVec = normalize(LightPosition.xyz);
        else
            lightVec = normalize(LightPosition.xyz - ecPosition);

        /////////////////////////////////////////////////////////////////////////////
        // TASK 3:
        // * Determine whether fragment is in wood region or mirror region.
        // * If fragment is in wood region,
        //    -- Read from wood texture map. 
        //    -- Perform Phong lighting computation using the wood texture 
        //       color as the ambient and diffuse material.
        //    -- Write computed fragment color to FragColor.
        // * If fragment is in mirror region,
        //    -- Construct eye-space Tangent and Binormal vectors.
        //    -- Construct tangent-space perturbation vector for a
        //       hemispherical bump.
        //    -- Transform perturbation vector to eye space.
        //    -- Reflect the view vector about the eye-space perturbation vector.
        //    -- Transform reflection vector to World Space.
        //    -- Use world-space reflection vector to access environment cubemap.
        //    -- Write computed fragment color to FragColor.
        /////////////////////////////////////////////////////////////////////////////
        // get diffuse color
        vec3 diffuseColor = texture(WoodDiffuseMap, v2fTexCoord.xy).rgb;
        // wood region
        vec3 reflectVec = reflect(-lightVec, necNormal);
        float N_dot_L = max(dot(necNormal, lightVec), 0.0);
        float R_dot_V = max(dot(reflectVec, viewVec), 0.0);
        float spec = (R_dot_V == 0) ? 0.0 : pow(R_dot_V, MatlShininess);
        vec3 tempWood =     LightAmbient.rgb * diffuseColor +
                            LightDiffuse.rgb * diffuseColor * N_dot_L +
                            LightSpecular.rgb * spec;
        // tangent and binormal vector
        vec3 ecTangent;
        vec3 ecBinormal;
        compute_tangent_vectors(necNormal, ecPosition, v2fTexCoord.xy, ecTangent, ecBinormal);
        // check if the point is in mirror region
        vec2 c = MirrorTileDensity * v2fTexCoord.st;
        vec2 p = fract(c) - vec2(0.5);
        float sqrDist = p.x * p.x + p.y * p.y;
        if (sqrDist >= MirrorRadius * MirrorRadius)  p = vec2(0.0);
        // perturbed normal vector
        vec3 tanPerturbedNormal = normalize(vec3(p.x, p.y, DeltaNormal_Z_Scale * 1.5));
        mat3 TBN = mat3(ecTangent, ecBinormal, necNormal);
        vec3 ecPerturbedNormal = TBN * tanPerturbedNormal;
        // light in mirror region
        vec3 ecReflect = reflect(-viewVec, ecPerturbedNormal);
        vec4 wcReflect = inverse(ViewMatrix) * vec4(ecReflect, 0.0);
        vec3 reflectColor = texture(EnvMap, wcReflect.xyz).rgb;

        if (sqrDist >= MirrorRadius * MirrorRadius)
            FragColor = vec4(tempWood, 1.0);
        else 
            FragColor = vec4(reflectColor, 1.0);

        ///////////////////////////////////
        // TASK 3: WRITE YOUR CODE HERE. //
        ///////////////////////////////////

    }
    else discard;
}



void main()
{
    switch(WhichObj) {
        case 0: drawSkybox(); break;
        case 1: drawBrickCube(); break;
        case 2: drawWoodenCube(); break;
    }
}
