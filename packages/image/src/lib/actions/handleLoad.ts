import { dev } from '$app/env';
import { EMPTY_DATA_URL, TAG } from '../constants';
import { loadedImageURLs } from '../singeltons';

import type {
	LayoutValue,
	OnLoadingComplete,
	PlaceholderValue,
} from '../../../types';

export default function handleLoad(
	img: HTMLImageElement,
	options: {
		src: string;
		layout: LayoutValue;
		placeholder: PlaceholderValue;
		onLoadingComplete?: OnLoadingComplete;
		errorHandler?: (e: ErrorEvent) => void;
	}
) {
	const {
		src,
		layout,
		placeholder,
		onLoadingComplete = () => {},
		errorHandler = () => {},
	} = options;

	async function loadHandler(e?: Event) {
		try {
			if (img.src !== EMPTY_DATA_URL) {
				await ('decode' in img ? img.decode() : Promise.resolve());

				if (placeholder === 'blur') {
					img.style.filter = 'none';
					img.style.backgroundSize = 'none';
					img.style.backgroundImage = 'none';
				}

				loadedImageURLs.add(src);

				const { naturalWidth, naturalHeight } = img;
				// Pass back read-only primitive values but not the
				// underlying DOM element because it could be misused.
				onLoadingComplete({ naturalWidth, naturalHeight });

				if (dev) {
					if (img.parentElement?.parentElement) {
						const parent = getComputedStyle(
							img.parentElement.parentElement
						);

						if (!parent.position) {
							// The parent has not been rendered to the dom yet and therefore it has no position. Skip the warnings for such cases.
						} else if (
							layout === 'responsive' &&
							parent.display === 'flex'
						) {
							console.warn(
								`${TAG} Image with src "${src}" may not render properly as a child of a flex container. Consider wrapping the image with a div to configure the width.`
							);
						} else if (
							layout === 'fill' &&
							parent.position !== 'relative' &&
							parent.position !== 'fixed'
						) {
							console.warn(
								`${TAG} Image with src "${src}" may not render properly with a parent using position:"${parent.position}". Consider changing the parent style to position:"relative" with a width and height.`
							);
						}
					}
				}
			}
		} catch (error) {}
	}

	if (img.complete) {
		loadHandler();
	} else {
		img.addEventListener('load', loadHandler);
		img.addEventListener('error', errorHandler);
	}

	return {
		destroy() {
			img.removeEventListener('load', loadHandler);
			img.addEventListener('error', errorHandler);
		},
	};
}
