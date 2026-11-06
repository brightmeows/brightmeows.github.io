/**
 * 按钮光效（Aero 风格按压光斑与悬停光标柔光）的宿主判定与委托接线。
 * 资格判定为纯函数；DOM 查找与监听器挂载供 PressGlow（全局按钮光效）
 * 与 PointerFxCanvas（按钮上跳过全局涟漪）共用。光效本体由 layout.css
 * 的 .press-glow-host 伪元素渲染，坐标经 CSS 变量传入。
 */

/** 可交互元素选择器：按钮、链接与 role=button（GlassCard 等可点卡片）。 */
export const INTERACTIVE_SELECTOR = "button, a, [role='button']";

/** 光效资格判定的输入：是否命中可交互元素与样式采样。 */
export interface GlowEligibility {
  /** 是否命中可交互元素 */
  hasInteractive: boolean;
  /** computed display 值 */
  display: string;
  /** computed border-radius 值 */
  borderRadius: string;
}

/**
 * 光效资格判定：只给盒状控件发光。inline 纯文本链接与圆角为零的元素
 * 不出矩形光晕；inline-flex、inline-block 等控件形态照常生效。
 */
export function isGlowEligible(eligibility: GlowEligibility): boolean {
  return (
    eligibility.hasInteractive &&
    eligibility.display !== "inline" &&
    Number.parseFloat(eligibility.borderRadius) > 0
  );
}

/** 从事件目标解析光效宿主；未命中可交互元素或非盒状控件时返回 null。 */
export function findGlowHost(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const match = target.closest(INTERACTIVE_SELECTOR);
  if (!(match instanceof HTMLElement)) return null;
  const style = getComputedStyle(match);
  if (
    !isGlowEligible({
      hasInteractive: true,
      display: style.display,
      borderRadius: style.borderRadius,
    })
  ) {
    return null;
  }
  return match;
}

/** 标记光效宿主：加宿主类，static 定位时补 relative（伪元素锚定需要）。 */
function markHost(element: HTMLElement): void {
  element.classList.add("press-glow-host");
  if (getComputedStyle(element).position === "static") {
    element.style.position = "relative";
  }
}

/** 把指针坐标换算成宿主局部坐标并写入一对 CSS 变量。 */
function setPointVars(
  element: HTMLElement,
  clientX: number,
  clientY: number,
  prefix: string
): void {
  const rect = element.getBoundingClientRect();
  element.style.setProperty(`--${prefix}-x`, `${clientX - rect.left}px`);
  element.style.setProperty(`--${prefix}-y`, `${clientY - rect.top}px`);
}

/**
 * 挂载全局委托监听：pointerdown 写按压点变量（按压光斑），鼠标
 * pointermove 写光标变量（悬停柔光，触屏不触发）；宿主按需标记。
 * 返回清理函数。
 */
export function attachPressGlow(): () => void {
  let hoverHost: HTMLElement | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    const host = findGlowHost(event.target);
    if (!host) return;
    markHost(host);
    setPointVars(host, event.clientX, event.clientY, "press");
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    const host = findGlowHost(event.target);
    if (host && host !== hoverHost) markHost(host);
    hoverHost = host;
    if (!host) return;
    setPointVars(host, event.clientX, event.clientY, "cursor");
  };

  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  return () => {
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
  };
}
