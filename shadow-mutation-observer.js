/* Mutation observers do not detect subtree changes on webcomponents
 * because they are part of the element's shadow root rather than
 * normal children. So, we must explicitly attach the mutation
 * observer to the shadow root of webcomponents if the browser supports
 * native Shadow DOM but not native ResizeObserver
 */
class ShadowMutationObserver {
	
	constructor( node, callback ) {
		this._callback = callback;
		this._trackedComponents = new Map();
		this._rootObserver = new MutationObserver( function( mutationRecords ) {
			// Start tracking any new webcomponents in the node's subtree
			mutationRecords.forEach( function( record ) {
				for( let i = 0; i < record.addedNodes.length; i++ ) {
					this._trackWebComponents( record.addedNodes[i] );
				}
			}.bind( this ));
			
			// Stop tracking webcomponents that are no longer descendants of the node
			this._trackedComponents.forEach( function( observer, trackedComponent ) {
				if( !node.contains( trackedComponent ) ) {
					observer.destroy();
					this._trackedComponents.delete( trackedComponent );
				}
			}.bind( this ));
			callback( mutationRecords );
		}.bind( this ));
		
		this._rootObserver.observe( node, {
			attributes: true,
			childList: true,
			characterData: true,
			subtree: true
		});
		this._trackWebComponents( node );
	}
	
	destroy() {
		this._rootObserver.disconnect();
		this._trackedComponents.forEach( function( observer, node ) {
			observer.destroy();
		});
		this._trackedComponents.clear();
	}
	
	_trackWebComponents( node ) {
		if( node.shadowRoot && !this._trackedComponents.get( node ) ) {
			this._trackedComponents.set(
				node,
				new ShadowMutationObserver( node.shadowRoot, this._callback )
			);
		}
		
		let children = node.children || node.childNodes || [];
		for( var i = 0; i < children.length; i++ ) {
			this._trackWebComponents( children[i] );
		}
	}
	
}

export default ShadowMutationObserver;
