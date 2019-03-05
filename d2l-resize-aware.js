import { PolymerElement, html } from '@polymer/polymer';
import { afterNextRender } from '@polymer/polymer/lib/utils/render-status.js';
import ShadowMutationObserver from './shadow-mutation-observer.js';

class D2LResizeAware extends PolymerElement {
	
	static get is() {
		return 'd2l-resize-aware';
	}
	
	static get template() {
		const template = html`
			<style>
				:host {
					display: inline-block;
				}
			</style>
			<slot id="slot"></slot>
		`;
		template.setAttribute('strip-whitespace', true);
		return template;
	}
	
	static get properties() {
		return {
			positionAware: {
				type: Boolean,
				value: false
			},
			
			_hasNativeResizeObserver: Boolean,
			_usingShadyDomPolyfill: Boolean,
			_isSafari: Boolean,
			_usingSafariWorkaround: Boolean,
			_destructor: Function,
			_lastSize: Object
		};
	}
	
	constructor() {
		super();
		
		this._hasNativeResizeObserver =
			window.ResizeObserver &&
			window.ResizeObserver.toString().indexOf( '[native code]' ) >= 0;
		
		this._isSafari =
			window.navigator.userAgent.indexOf( 'Safari/' ) >= 0 &&
			window.navigator.userAgent.indexOf( 'Chrome/' ) === -1;
			
		this._destructor = null;
		this._onPossibleResize = this._onPossibleResize.bind( this );
	}
	
	ready() {
		super.ready();
		this._usingShadyDomPolyfill = !!this.__shady;
	}
	
	connectedCallback() {
		super.connectedCallback();
		this._lastSize = this.getBoundingClientRect();
		afterNextRender( this, this._initialize.bind( this ) );
		this._onResize();
	}
	
	disconnectedCallback() {
		if( this._destructor ) {
			this._destructor();
			this._destructor = null;
		}
		super.disconnectedCallback();
	}
	
	_initialize() {
		if( this._destructor ) {
			this._destructor();
			this._destructor = null;
		}
		
		this._usingSafariWorkaround = false;
		if( this._hasNativeResizeObserver ) {
			/* Use native ResizeObserver */
			const observer = new window.ResizeObserver( this._onPossibleResize );
			observer.observe( this );
			this._destructor = observer.unobserve.bind( observer, this );
		} else if ( this._usingShadyDomPolyfill ) {
			/* Use a mutation observer and rely on the Shady DOM polyfill to make it work */
			const callback = this._onPossibleResize;
			window.addEventListener( 'resize', callback );
			document.addEventListener( 'transitionend', callback );
			
			const mutationObserver = new MutationObserver( callback );
			mutationObserver.observe( this, {
				attributes: true,
				childList: true,
				characterData: true,
				subtree: true
			});
			
			this._destructor = function() {
				window.removeEventListener( 'resize', callback );
				document.removeEventListener( 'transitionend', callback );
				mutationObserver.disconnect();
			}.bind( this );
		} else {
			/* Monitor all webcomponents in the subtree for changes */
			const callback = this._onPossibleResize;
			window.addEventListener( 'resize', callback );
			document.addEventListener( 'transitionend', callback );
			
			let mutationObservers = [];
			const checkIfSafariWorkaroundIsRequired = function() {
				if( !this._isSafari ) return;
				this._changeSafariWorkaroundStatus(
					mutationObservers.some( o => o.hasTextarea )
				);
			}.bind( this );
			
			const onSlotChanged = function() {
				mutationObservers.forEach( observer => observer.destroy() );
				
				mutationObservers = this.$.slot.assignedNodes({ flatten: true }).map( child => {
					const shadowObserver = new ShadowMutationObserver( child, callback );
					shadowObserver.onHasTextareaChanged = checkIfSafariWorkaroundIsRequired.bind( this );
					shadowObserver.onTransitionEnd = callback;
					return shadowObserver;
				});
				
				this._onPossibleResize();
				checkIfSafariWorkaroundIsRequired();
			}.bind( this );
			
			this.$.slot.addEventListener( 'slotchange', onSlotChanged );
			onSlotChanged(); // Safari needs this
			
			this._destructor = function() {
				window.removeEventListener( 'resize', callback );
				document.removeEventListener( 'transitionend', callback );
				this.$.slot.removeEventListener( 'slotchange', onSlotChanged );
				mutationObservers.forEach( observer => observer.destroy() );
			}.bind( this );
		}
		
		this._onPossibleResize();
	}
	
	_onPossibleResize() {
		const newSize = this.getBoundingClientRect();
		if(
			newSize.width !== this._lastSize.width ||
			newSize.height !== this._lastSize.height ||
			this.positionAware && (
				newSize.x !== this._lastSize.x ||
				newSize.y !== this._lastSize.y
			)
		) {
			this._onResize();
		}
	}
	
	_onResize() {
		const newSize = this.getBoundingClientRect();
		this.dispatchEvent(
			new CustomEvent(
				'd2l-resize-aware-resized',
				{
					target: this,
					detail: {
						previous: this._lastSize,
						current: newSize
					}
				}
			)
		);
		this._lastSize = newSize;
	}
	
	_changeSafariWorkaroundStatus( useWorkaround ) {
		if( this._usingSafariWorkaround === !!useWorkaround ) {
			return;
		}
		
		/* Safari's MutationObserver does not detect resizes on native textareas
		 * that occur as a result of the user dragging the resizer, so we just
		 * have to poll for changes in this case, but only on frames where the
		 * user could be resizing the textbox. Putting a mousemove event
		 * listener on this element won't work because the textbox lags behind
		 * the cursor, but we can at least only do a resize check when the mouse
		 * is moving instead of on every frame.
		 *
		 * This workaround is only used if there is a textarea element somewhere
		 * inside this element that does not have 'resize: none' in its styling,
		 * and only if the browser is Safari.
		 */
		if( useWorkaround ) {
			window.addEventListener( 'mousemove', this._onPossibleResize );
			window.addEventListener( 'touchmove', this._onPossibleResize );
		} else {
			window.removeEventListener( 'mousemove', this._onPossibleResize );
			window.removeEventListener( 'touchmove', this._onPossibleResize );
		}
		this._usingSafariWorkaround = !!useWorkaround;
	}
	
}

customElements.define( D2LResizeAware.is, D2LResizeAware );