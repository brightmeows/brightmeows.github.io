<script lang="ts">
  import {
    LG_BAR_MAP,
    LG_CIRCLE_MAP,
    LG_FILTER_BAR,
    LG_FILTER_CIRCLE,
  } from "$lib/constants/liquid-glass";

  /*
   * 液态玻璃折射滤镜定义（隐藏 SVG，全站挂载一次）：
   * feImage 位移图 + RGB 分通道位移（scale 递减）叠加色散，feBlend screen 合成。
   * 供 layout.css 的 .lg-refract-bar / .lg-refract-circle 通过 filter: url() 引用；
   * 不支持 url() 滤镜的浏览器会丢弃该声明，优雅退回纯 Liquid Aqua 玻璃。
   * 只用于折射表面层（独立绝对定位 div），不直接作用于含内容的容器。
   */
</script>

<!-- 折射滤镜定义：说明见上方 script 注释 -->
<svg aria-hidden="true" style="position: absolute; width: 0; height: 0; overflow: hidden">
  <defs>
    <filter
      id={LG_FILTER_BAR}
      x="-3%"
      y="-40%"
      width="106%"
      height="180%"
      color-interpolation-filters="sRGB"
    >
      <feImage
        href={`data:image/png;base64,${LG_BAR_MAP}`}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        result="map"
      />
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
        result="srcR"
      />
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"
        result="srcG"
      />
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"
        result="srcB"
      />
      <feDisplacementMap
        in="srcR"
        in2="map"
        scale="12"
        xChannelSelector="R"
        yChannelSelector="G"
        result="dR"
      />
      <feDisplacementMap
        in="srcG"
        in2="map"
        scale="9"
        xChannelSelector="R"
        yChannelSelector="G"
        result="dG"
      />
      <feDisplacementMap
        in="srcB"
        in2="map"
        scale="6"
        xChannelSelector="R"
        yChannelSelector="G"
        result="dB"
      />
      <feBlend in="dR" in2="dG" mode="screen" result="rg" />
      <feBlend in="rg" in2="dB" mode="screen" />
    </filter>
    <filter
      id={LG_FILTER_CIRCLE}
      x="-20%"
      y="-20%"
      width="140%"
      height="140%"
      color-interpolation-filters="sRGB"
    >
      <feImage
        href={`data:image/png;base64,${LG_CIRCLE_MAP}`}
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        result="map"
      />
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
        result="srcR"
      />
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"
        result="srcG"
      />
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"
        result="srcB"
      />
      <feDisplacementMap
        in="srcR"
        in2="map"
        scale="15"
        xChannelSelector="R"
        yChannelSelector="G"
        result="dR"
      />
      <feDisplacementMap
        in="srcG"
        in2="map"
        scale="11"
        xChannelSelector="R"
        yChannelSelector="G"
        result="dG"
      />
      <feDisplacementMap
        in="srcB"
        in2="map"
        scale="7"
        xChannelSelector="R"
        yChannelSelector="G"
        result="dB"
      />
      <feBlend in="dR" in2="dG" mode="screen" result="rg" />
      <feBlend in="rg" in2="dB" mode="screen" />
    </filter>
  </defs>
</svg>
