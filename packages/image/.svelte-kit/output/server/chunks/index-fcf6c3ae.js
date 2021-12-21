import { c as create_ssr_component, a as createEventDispatcher, s as spread, b as escape_attribute_value, d as escape_object, f as add_attribute, e as escape, n as null_to_empty, v as validate_component } from "./app-2747eac5.js";
import "@sveltejs/kit/ssr";
const imageConfigDefault = {
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  path: "/_kit/image",
  loader: "default",
  domains: [],
  minimumCacheTTL: 60,
  formats: ["image/webp", "image/avif"]
};
function normalizeSrc(src) {
  return src[0] === "/" ? src.slice(1) : src;
}
function imgixLoader({
  root,
  src,
  width,
  quality
}) {
  const url = new URL(`${root}${normalizeSrc(src)}`);
  const params = url.searchParams;
  params.set("auto", params.get("auto") || "format");
  params.set("fit", params.get("fit") || "max");
  params.set("w", params.get("w") || width.toString());
  if (quality) {
    params.set("q", quality.toString());
  }
  return url.href;
}
function akamaiLoader({
  root,
  src,
  width
}) {
  return `${root}${normalizeSrc(src)}?imwidth=${width}`;
}
function cloudinaryLoader({
  root,
  src,
  width,
  quality
}) {
  const params = [
    "f_auto",
    "c_limit",
    "w_" + width,
    "q_" + (quality || "auto")
  ];
  const paramsString = params.join(",") + "/";
  return `${root}${paramsString}${normalizeSrc(src)}`;
}
function defaultImageLoader(loaderProps) {
  const load = loaders.get(configLoader);
  if (load) {
    return load({ root: configPath, ...loaderProps });
  }
  throw new Error(`Unknown "loader" found in "next.config.js". Expected: ${VALID_LOADERS.join(", ")}. Received: ${configLoader}`);
}
function defaultLoader({
  root,
  src,
  width,
  quality
}) {
  const encodedSrc = encodeURIComponent(src);
  const url = `${root}?url=${encodedSrc}&w=${width}&q=${quality || 75}`;
  return url;
}
function customLoader({ src }) {
  throw new Error(`${TAG} Image with src "${src}" is missing "loader" prop.
`);
}
const EMPTY_DATA_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const TAG = "IMAGE COMPONENT:";
const VALID_LOADERS = [
  "default",
  "imgix",
  "cloudinary",
  "akamai",
  "custom"
];
const {
  deviceSizes: configDeviceSizes,
  imageSizes: configImageSizes,
  loader: configLoader,
  path: configPath,
  domains: configDomains
} = { ...imageConfigDefault, ...{ "minimumCacheTTL": 8e3 } };
const allSizes = [...configDeviceSizes, ...configImageSizes];
configDeviceSizes.sort((a, b) => a - b);
allSizes.sort((a, b) => a - b);
const loaders = new Map([
  ["default", defaultLoader],
  ["imgix", imgixLoader],
  ["cloudinary", cloudinaryLoader],
  ["akamai", akamaiLoader],
  ["custom", customLoader]
]);
function getInt(x) {
  if (typeof x === "number") {
    return x;
  }
  if (typeof x === "string") {
    return parseInt(x, 10);
  }
  return void 0;
}
function generateImgAttrs({
  src,
  unoptimized,
  layout,
  width,
  quality,
  sizes,
  loader
}) {
  if (unoptimized) {
    return { src, srcset: void 0, sizes: void 0 };
  }
  const { widths, kind } = getWidths(width, layout, sizes);
  const last = widths.length - 1;
  return {
    sizes: !sizes && kind === "w" ? "100vw" : sizes,
    srcset: widths.map((w, i) => {
      const img = loader({ src, quality, width: w });
      return `${img} ${kind === "w" ? w : i + 1}${kind}`;
    }).join(", "),
    src: loader({ src, quality, width: widths[last] })
  };
}
function getWidths(width, layout, sizes) {
  if (sizes && (layout === "fill" || layout === "responsive")) {
    const viewportWidthRe = /(^|\s)(1?\d?\d)vw/g;
    const percentSizes = [];
    for (let match; match = viewportWidthRe.exec(sizes); match) {
      percentSizes.push(parseInt(match[2]));
    }
    if (percentSizes.length) {
      const smallestRatio = Math.min(...percentSizes) * 0.01;
      return {
        widths: allSizes.filter((s) => s >= configDeviceSizes[0] * smallestRatio),
        kind: "w"
      };
    }
    return { widths: allSizes, kind: "w" };
  }
  if (typeof width !== "number" || layout === "fill" || layout === "responsive") {
    return { widths: configDeviceSizes, kind: "w" };
  }
  const widths = [
    ...new Set([width, width * 2].map((w) => allSizes.find((p) => p >= w) || allSizes[allSizes.length - 1]))
  ];
  return { widths, kind: "x" };
}
function toBase64(str = "") {
  if (typeof window === "undefined") {
    return Buffer.from(str).toString("base64");
  }
  if (typeof self !== "undefined") {
    return self.btoa(str);
  }
  return window.btoa(str);
}
var Image_svelte_svelte_type_style_lang = "";
const css = {
  code: ".img.svelte-159qy9f{position:absolute;top:0;left:0;bottom:0;right:0;box-sizing:border-box;padding:0;border:none;margin:auto;display:block;width:0;height:0;min-width:100%;max-width:100%;min-height:100%;max-height:100%;object-fit:var(--image-blur-bg-size);object-position:var(--image-blur-bg-position)}.img-blur.svelte-159qy9f{filter:blur(20px);background-size:var(--image-blur-bg-size, cover);background-image:var(--image-blur-bg-image);background-position:var(--image-blur-bg-position, 0% 0%)}.img-sizer-svg.svelte-159qy9f{display:block;max-width:100%;width:initial;height:initial;background:none;opacity:1;border:0;margin:0;padding:0}.img-wrapper.svelte-159qy9f,.img-sizer.svelte-159qy9f{display:block;width:initial;height:initial;background:none;opacity:1;border:0;margin:0;padding:0}.img-wrapper.svelte-159qy9f{overflow:hidden}.img-wrapper.fill.svelte-159qy9f{display:block;position:absolute;top:0;left:0;right:0;bottom:0}.img-wrapper.responsive.svelte-159qy9f{display:block;position:relative}.img-wrapper.intrinsic.svelte-159qy9f{display:inline-block;position:relative;max-width:100%}.img-wrapper.fixed.svelte-159qy9f{display:inline-block;position:relative;width:var(--image-width);height:var(--image-height)}.img-sizer.responsive.svelte-159qy9f{padding-top:--image-paddin-top, 100%}.img-sizer.intrinsic.svelte-159qy9f{max-width:100%}",
  map: null
};
const Image = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { class: klass = "" } = $$props;
  let { src } = $$props;
  let { image } = $$props;
  let { width = 0 } = $$props;
  let { height = 0 } = $$props;
  let { alt = "" } = $$props;
  let { loading = "lazy" } = $$props;
  let { decoding = "async" } = $$props;
  let { objectFit = "cover" } = $$props;
  let { objectPosition = "0% 0%" } = $$props;
  let { layout = "intrinsic" } = $$props;
  let { lazyBoundary = "200px" } = $$props;
  let { placeholder = "empty" } = $$props;
  let { errorPlaceholder = " " } = $$props;
  let { blurDataURL = void 0 } = $$props;
  let { quality = 75 } = $$props;
  let { priority = false } = $$props;
  let { unoptimized = false } = $$props;
  let { sizes = void 0 } = $$props;
  let { loader = defaultImageLoader } = $$props;
  let isLazy = !priority && (loading === "lazy" || typeof loading === "undefined");
  if (src.startsWith("data:") || src.startsWith("blob:")) {
    unoptimized = true;
    isLazy = false;
  }
  const widthInt = getInt(width);
  const heightInt = getInt(height);
  const qualityInt = getInt(quality);
  const sizerSvg = layout === "intrinsic" ? `<svg width="${widthInt}" height="${heightInt}" xmlns="http://www.w3.org/2000/svg" version="1.1"/>` : void 0;
  let hasSizer = false;
  switch (layout) {
    case "responsive":
      hasSizer = true;
      break;
    case "intrinsic":
      hasSizer = true;
      break;
    case "fill":
      hasSizer = false;
      break;
    case "fixed":
      hasSizer = false;
      break;
  }
  let isIntersected = false;
  let imgAttributes = {
    src: EMPTY_DATA_URL,
    srcset: void 0,
    sizes: void 0
  };
  const quotient = (widthInt || 1) / (widthInt || 1);
  const paddingTop = isNaN(quotient) ? "100%" : `${quotient * 100}%`;
  const cssVars = `
	--image-width: ${widthInt};
	--image-height: ${heightInt};
	--image-padding-top: ${paddingTop};
	--image-blur-bg-size: ${objectFit};
	--image-blur-bg-image: url("${blurDataURL || ""}");
	--image-blur-bg-position: ${objectPosition};
	`;
  const noScriptImgAttributes = generateImgAttrs({
    src,
    unoptimized,
    layout,
    width: widthInt,
    quality: qualityInt,
    sizes,
    loader
  });
  const linkProps = {
    imagesrcset: imgAttributes.srcset,
    imagesizes: imgAttributes.sizes
  };
  createEventDispatcher();
  if ($$props.class === void 0 && $$bindings.class && klass !== void 0)
    $$bindings.class(klass);
  if ($$props.src === void 0 && $$bindings.src && src !== void 0)
    $$bindings.src(src);
  if ($$props.image === void 0 && $$bindings.image && image !== void 0)
    $$bindings.image(image);
  if ($$props.width === void 0 && $$bindings.width && width !== void 0)
    $$bindings.width(width);
  if ($$props.height === void 0 && $$bindings.height && height !== void 0)
    $$bindings.height(height);
  if ($$props.alt === void 0 && $$bindings.alt && alt !== void 0)
    $$bindings.alt(alt);
  if ($$props.loading === void 0 && $$bindings.loading && loading !== void 0)
    $$bindings.loading(loading);
  if ($$props.decoding === void 0 && $$bindings.decoding && decoding !== void 0)
    $$bindings.decoding(decoding);
  if ($$props.objectFit === void 0 && $$bindings.objectFit && objectFit !== void 0)
    $$bindings.objectFit(objectFit);
  if ($$props.objectPosition === void 0 && $$bindings.objectPosition && objectPosition !== void 0)
    $$bindings.objectPosition(objectPosition);
  if ($$props.layout === void 0 && $$bindings.layout && layout !== void 0)
    $$bindings.layout(layout);
  if ($$props.lazyBoundary === void 0 && $$bindings.lazyBoundary && lazyBoundary !== void 0)
    $$bindings.lazyBoundary(lazyBoundary);
  if ($$props.placeholder === void 0 && $$bindings.placeholder && placeholder !== void 0)
    $$bindings.placeholder(placeholder);
  if ($$props.errorPlaceholder === void 0 && $$bindings.errorPlaceholder && errorPlaceholder !== void 0)
    $$bindings.errorPlaceholder(errorPlaceholder);
  if ($$props.blurDataURL === void 0 && $$bindings.blurDataURL && blurDataURL !== void 0)
    $$bindings.blurDataURL(blurDataURL);
  if ($$props.quality === void 0 && $$bindings.quality && quality !== void 0)
    $$bindings.quality(quality);
  if ($$props.priority === void 0 && $$bindings.priority && priority !== void 0)
    $$bindings.priority(priority);
  if ($$props.unoptimized === void 0 && $$bindings.unoptimized && unoptimized !== void 0)
    $$bindings.unoptimized(unoptimized);
  if ($$props.sizes === void 0 && $$bindings.sizes && sizes !== void 0)
    $$bindings.sizes(sizes);
  if ($$props.loader === void 0 && $$bindings.loader && loader !== void 0)
    $$bindings.loader(loader);
  $$result.css.add(css);
  imgAttributes = !isLazy || isIntersected ? generateImgAttrs({
    src,
    unoptimized,
    layout,
    width: widthInt,
    quality: qualityInt,
    sizes,
    loader
  }) : imgAttributes;
  return `${$$result.head += `${priority ? `<link${spread([
    { rel: "preload" },
    { as: "image" },
    {
      href: escape_attribute_value(imgAttributes.srcset ? void 0 : imgAttributes.src)
    },
    {
      "data-key": escape_attribute_value("__kimg-" + imgAttributes.src + imgAttributes.srcset + imgAttributes.sizes)
    },
    escape_object(linkProps)
  ], "svelte-159qy9f")} data-svelte="svelte-1rzji5m">` : ``}`, ""}



<span${add_attribute("style", cssVars, 0)} class="${escape(null_to_empty(`img-wrapper ${layout ? layout : ""}`)) + " svelte-159qy9f"}"><span${add_attribute("style", hasSizer ? "" : "display: none;", 0)} class="${escape(null_to_empty(`img-sizer ${layout ? layout : ""}`)) + " svelte-159qy9f"}"${add_attribute("aria-hidden", true, 0)}><img${add_attribute("decoding", decoding, 0)} class="${"img-sizer-svg svelte-159qy9f"}"${add_attribute("src", `data:image/svg+xml;base64,${toBase64(sizerSvg)}`, 0)} alt="${"Hidden SVG"}"${add_attribute("aria-hidden", true, 0)}></span>
	<img${spread([
    { loading: escape_attribute_value(loading) },
    {
      decoding: escape_attribute_value(decoding)
    },
    { alt: escape_attribute_value(alt) },
    { height: escape_attribute_value(height) },
    { width: escape_attribute_value(width) },
    escape_object(imgAttributes),
    {
      class: escape_attribute_value(`img ${klass}`)
    },
    {
      "data-kimg": escape_attribute_value(layout)
    }
  ], (placeholder === "blur" ? "img-blur" : "") + " svelte-159qy9f")}${add_attribute("this", image, 0)}>
	<noscript><img${spread([
    escape_object(noScriptImgAttributes),
    { alt: escape_attribute_value(alt) },
    { loading: escape_attribute_value(loading) },
    {
      decoding: escape_attribute_value(decoding)
    },
    {
      class: escape_attribute_value(`img ${klass}`)
    },
    {
      "data-kimg": escape_attribute_value(layout)
    }
  ], "svelte-159qy9f")}></noscript>
</span>`;
});
const Routes = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="${"https://kit.svelte.dev"}">kit.svelte.dev</a> to read the documentation</p>
${validate_component(Image, "Image").$$render($$result, {
    src: "/favicon.png",
    width: 300,
    height: 300
  }, {}, {})}`;
});
export { Routes as default };
