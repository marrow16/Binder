/*
 * binder.js
 *
 * Copyright 2017 Martin Rowlinson. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
// attach to CommonJS, AMD, Node, or Window
// inspired by https://github.com/addyosmani/memoize.js/blob/master/memoize.js
(function(root, factory) {
	if (typeof define === 'function' && define.amd) { // eslint-disable-line no-undef
		// AMD. Register as an anonymous module.
		define([], factory); // eslint-disable-line no-undef
	} else if (typeof exports === 'object') {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like environments that support module.exports,
		// like Node.
		module.exports = factory();
	} else {
		// Browser globals (root is window)
		root.Binder = factory();
	}
}(this, function() {
	'use strict';

	function Binder(/*DOMElement | string*/template, /*object*/bindings,
					/*[object]*/ bindingsScope, /*[boolean]*/ inplaceMode,
					/*[object]*/ options) {
		// setup internals...
		// is this an in-place binder or a cookie-cutter binder...
		var inplace = (typeof inplaceMode === 'boolean') && inplaceMode;
		// the scope for binding functions (in the bindings) is the supplied scope, if specified, or the bindings object itself...
		var functionScope = bindingsScope || bindings;
		// grab any options...
		var bindWarnings = (typeof options === 'object' ? (typeof options.bindWarnings === 'boolean' ? options.bindWarnings : false) : false);
		var compileWarnings = (typeof options === 'object' ? (typeof options.compileWarnings === 'boolean' ? options.compileWarnings : false) : false);
		// work out the reset and template nodes (depends on whether we're in-place or cookie cutter)...
		var resetNode,templateNode;
		if (inplace) {
			// it's an inplace binder - so the node argument must be an DOM HTML Element...
			if (!isElement(template)) {
				throw new TypeError("Binder constructor: Argument 'template' must be an existing DOM HTMLElement!");
			}
			templateNode = template;
			resetNode = template.cloneNode(true);
		} else {
			// it's a cookie-cutter binder...
			if (typeof template === 'string') {
				// template defined as a string - create a node out of it...
				var fragment = document.createElement('div');
				fragment.innerHTML = template;
				resetNode = fragment.firstElementChild;
			} else if (isElement(template)) {
				if ('content' in template) {
					// it's a HTML <template>...
					resetNode = document.importNode(template.content, true).firstElementChild;
				} else {
					resetNode = template;
				}
			} else {
				throw new TypeError("Binder constructor: Argument 'template' must be a string or DOM HTMLElement!");
			}
			// the actual template used (that will have nodes populated by selectors) is a clone of the supplied template...
			templateNode = resetNode.cloneNode(true);
		}
		// declare vars containing 'compiled' bindings...
		var bindingFunctions = []; // actual binding functions
		var postClonePropertyBindings = []; // binding functions that must be run after cloning
		var rebindingFunctions = [];
		var rebindingResetFunctions = [];
		var eventBindings = []; // list of event bindings - each object
		var resetFunctions = [];
		var uniqueResetsMap = {}; // map of selectors to avoid creating duplicate resets
		var afterBindEvent; // any @event.bound event specified
		// run through the bindings to compile...
		for (var pty in bindings) {
			if (bindings.hasOwnProperty(pty)) {
				bindingFactory(pty, bindings[pty]);
			}
		}
		if (inplace) {
			// it's an in-place binder, so add the event bindings now...
			addEventBindings(templateNode);
		}

		function bindingFactory(/*string*/bindingSelector, /*function|object|string*/bindingInstruction) {
			if (typeof bindingInstruction === 'object') {
				// the instruction is an object - so treat each child property as a descendant selector & instruction of the current selector...
				for (var pty in bindingInstruction) {
					if (bindingInstruction.hasOwnProperty(pty)) {
						// watch out for '!' at start of sub-selectors...
						if (pty.substr(0,1) === '!') {
							bindingFactory((bindingSelector.substr(0,1) === '!' ? '' : '!') + bindingSelector + ' ' + pty.substr(1), bindingInstruction[pty]);
						} else {
							bindingFactory(bindingSelector + ' ' + pty, bindingInstruction[pty]);
						}
					}
				}
				// we're done now, the descendant bindings will have been created...
				return;
			}
			var cssSelector = bindingSelector.trim();
			var noRebind = false;
			if (cssSelector.substr(0,1) === '!') {
				// the selector starts with an exclamation mark - which means it's not to be used for rebindig...
				cssSelector = cssSelector.substr(1).trim();
				noRebind = true;
				if (inplace && compileWarnings) {
					console.warn("Binder constructor: Once only binding selector '!" + cssSelector + "' ignored for in-place binders");
				}
			}
			if (cssSelector.substr(0,1) === '>') {
				cssSelector = ':scope ' + cssSelector;
			}
			var dataGetter = createDataGetter(bindingInstruction, cssSelector);
			var actualNode;
			var binding;
			if (cssSelector.indexOf('@') !== -1) {
				// there is an attribute or event specifier on the end of the selector...
				var selectorParts = cssSelector.split('@');
				if (selectorParts.length !== 2) {
					throw new TypeError("Binder constructor: Binding selector '" + cssSelector + "' contains multiple attribute/event tokens!");
				}
				cssSelector = stripEndChildSelector(selectorParts[0]);
				actualNode = getActualNode(cssSelector);
				var attributeToken = selectorParts[1].trim();
				var attributeTokenParts = attributeToken.split('.');
				if (attributeTokenParts.length === 1) {
					// it's just an attribute value setter...
					binding = createAttributeSetBinding(actualNode, dataGetter, cssSelector, attributeToken);
				} else if (attributeTokenParts.length === 2) {
					var attributeSubInstruction = attributeTokenParts[1].trim();
					attributeToken = attributeTokenParts[0].trim();
					switch (attributeToken) {
						case 'property':
						case 'pty':
							binding = createPropertyBinding(actualNode, dataGetter, cssSelector, attributeSubInstruction);
							break;
						case 'class':
							createResetFunction(actualNode, cssSelector, attributeToken, noRebind);
							switch (attributeSubInstruction) {
								case 'add':
									binding = createClassAddBinding(actualNode, dataGetter, cssSelector);
									break;
								case 'remove':
									binding = createClassRemoveBinding(actualNode, dataGetter, cssSelector);
									break;
								default:
									throw new TypeError("Binder constructor: Binding selector '" + cssSelector + "@" + attributeToken + "." + attributeSubInstruction + "' is invalid - @class attribute can only have sub-instructions of '.add' or '.remove'!");
							}
							break;
						case 'dataset':
							binding = createDatasetBinding(actualNode, dataGetter, cssSelector, attributeSubInstruction);
							break;
						case 'style':
							createResetFunction(actualNode, cssSelector, attributeToken, noRebind);
							binding = createStyleBinding(actualNode, dataGetter, cssSelector, attributeSubInstruction);
							break;
						case 'event':
							// for events the binding instruction must be a function...
							if (typeof bindingInstruction !== 'function') {
								throw TypeError("Binder constructor: Event binding instruction for selector '" + cssSelector + "@" + attributeToken + "." + attributeSubInstruction + "' must be a function!");
							}
							if (attributeSubInstruction === 'bound') {
								if (afterBindEvent) {
									throw TypeError("Binder constructor: Only one 'bound' event can be specified!");
								}
								afterBindEvent = dataGetter;
							} else {
								// add the event binding...
								eventBindings.push({
									eventName: attributeSubInstruction,
									cssSelector: cssSelector,
									eventFunction: dataGetter // we use the bound function rather than the original function
								});
							}
							break;
						default:
							// the only allowed sub-instruction on all attributes is '.remove'...
							createResetFunction(actualNode, cssSelector, attributeToken, noRebind);
							if (attributeSubInstruction === 'remove') {
								if (typeof bindingInstruction !== 'function' && compileWarnings) {
									console.warn("Binder constructor: Attribute remove '" + cssSelector + "' - usually expects function as binding instruction");
								}
								binding = createRemoveAttributeBinding(actualNode, dataGetter, cssSelector, attributeToken);
							} else {
								throw new TypeError("Binder constructor: Binding selector '" + cssSelector + "@" + attributeToken + "." + attributeSubInstruction + "' is invalid - only @class, @event, @dataset and @style attributes can have sub-instructions!");
							}
					}
				} else {
					// too many dots in the attribute token...
					throw new TypeError("Binder constructor: Binding selector '" + cssSelector + "@" + attributeToken + "' contains multiple '.' sub-instructions!");
				}
			} else if (cssSelector.substr(0 - '#append'.length) === '#append') {
				// the append binding instruction must be a function that will return the nodes to append...
				if (!(typeof bindingInstruction === 'function')) {
					throw new TypeError("Binder constructor: Binding instruction for selector '" + cssSelector + " #append' must be a function!");
				}
				// it's an append nodes instruction...
				cssSelector = stripEndChildSelector(stripEndToken(cssSelector, '#append'));
				actualNode = getActualNode(cssSelector);
				binding = createAppendNodesBinding(actualNode, dataGetter, cssSelector);
			} else if (cssSelector.substr(0 - '#innerHTML'.length) === '#innerHTML') {
				// it's an inner HTML instruction...
				cssSelector = stripEndChildSelector(stripEndToken(cssSelector, '#innerHTML'));
				actualNode = getActualNode(cssSelector);
				binding = createInnerHtmlBinding(actualNode, dataGetter, cssSelector);
			} else {
				// it's a text content instruction...
				// the selector may or may not end with an explicit '#textContent' token...
				cssSelector = stripEndChildSelector((cssSelector.substr(0 - '#textContent'.length) === '#textContent' ? stripEndToken(cssSelector, '#textContent') : cssSelector));
				actualNode = getActualNode(cssSelector);
				binding = createTextContentBinding(actualNode, dataGetter, cssSelector);
			}
			// add the binding function to the list...
			if (binding) {
				if (binding.nonCloneable) {
					postClonePropertyBindings.push(binding.bindingFunction);
				} else {
					bindingFunctions.push(binding.bindingFunction);
				}
				if (binding.rebindingFunction && !noRebind) {
					rebindingFunctions.push(binding.rebindingFunction);
				}
			}
		}

		/**
		 * Internal function for creating property binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @param {String} propertyName - the name of the property
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createPropertyBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/propertyName) {
			if (!inplace) {
				return {
					nonCloneable: true,
					bindingFunction: function(data, boundNode) {
						var setValue = dataGetter(data);
						if (!(typeof setValue === 'undefined')) {
							var setNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
							if (setNode) {
								setNode[propertyName] = setValue;
							}
						}
					},
					rebindingFunction: function(data, boundNode) {
						var setValue = dataGetter(data);
						if (!(typeof setValue === 'undefined')) {
							var setNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
							if (setNode) {
								setNode[propertyName] = setValue;
							}
						}
					}
				};
			}
			return {
				bindingFunction: function(data) {
					var setValue = dataGetter(data);
					if (!(typeof setValue === 'undefined')) {
						actualNode[propertyName] = setValue;
					}
				},
				rebindingFunction: function(data, boundNode) {
					var setValue = dataGetter(data);
					if (!(typeof setValue === 'undefined')) {
						var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
						if (rebindNode) {
							rebindNode[propertyName] = setValue;
						}
					}
				}
			};
		}

		/**
		 * Internal function for creating attribute set binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @param {String} attributeName - the name of the attribute
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createAttributeSetBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/attributeName) {
			return {
				bindingFunction: function(data){
					actualNode.setAttribute(attributeName, dataGetter(data));
				},
				rebindingFunction: function(data, boundNode) {
					var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
					if (rebindNode) {
						rebindNode.setAttribute(attributeName, dataGetter(data));
					}
				}
			};
		}

		/**
		 * Internal function for creating class add binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createClassAddBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
			return {
				bindingFunction: function(data) {
					var addToken = dataGetter(data);
					if (typeof addToken === 'string') {
						actualNode.classList.add(addToken);
					} else if (addToken instanceof Array) {
						addToken.forEach(function(token) {
							actualNode.classList.add(token);
						});
					}
				},
				rebindingFunction: function(data, boundNode) {
					var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
					var addToken = dataGetter(data);
					if (typeof addToken === 'string') {
						rebindNode.classList.add(addToken);
					} else if (addToken instanceof Array) {
						addToken.forEach(function(token) {
							rebindNode.classList.add(token);
						});
					}
				}
			};
		}

		/**
		 * Internal function for creating class remove binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createClassRemoveBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
			return {
				bindingFunction: function(data) {
					var removeToken = dataGetter(data);
					if (typeof removeToken === 'string') {
						actualNode.classList.remove(removeToken);
					} else if (removeToken instanceof Array) {
						removeToken.forEach(function(token) {
							actualNode.classList.remove(token);
						});
					}
				},
				rebindingFunction: function(data, boundNode) {
					var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
					var removeToken = dataGetter(data);
					if (typeof removeToken === 'string') {
						rebindNode.classList.remove(removeToken);
					} else if (removeToken instanceof Array) {
						removeToken.forEach(function(token) {
							rebindNode.classList.remove(token);
						});
					}
				}
			};
		}

		/**
		 * Internal function for creating dataset binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createDatasetBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/dataName) {
			return {
				bindingFunction: function(data) {
					actualNode.dataset[dataName] = dataGetter(data);
				},
				rebindingFunction: function(data, boundNode) {
					var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
					rebindNode.dataset[dataName] = dataGetter(data);
				}
			};
		}

		/**
		 * Internal function for creating style binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @param {String} styleProperty - the style property name
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createStyleBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/styleProperty) {
			return {
				bindingFunction: function(data) {
					actualNode.style[styleProperty] = dataGetter(data);
				},
				rebindingFunction: function(data, boundNode) {
					var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
					rebindNode.style[styleProperty] = dataGetter(data);
				}
			};
		}

		/**
		 * Internal function for creating remove attribute binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @param {String} attributeName - the attribute name
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createRemoveAttributeBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/attributeName) {
			return {
				bindingFunction: function(data) {
					var remove = dataGetter(data);
					if (remove) {
						actualNode.removeAttribute(attributeName);
					}
				},
				rebindingFunction: function(data, boundNode) {
					var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
					var remove = dataGetter(data);
					if (remove) {
						rebindNode.removeAttribute(attributeName);
					} else {
						// we'll reinstate the attribute if it was there on the original node...
						var origNode = (cssSelector ? resetNode.querySelector(cssSelector) : resetNode);
						if (origNode) {
							boundNode.setAttribute(attributeName, origNode.getAttribute(attributeName));
						}
					}
				}
			};
		}

		/**
		 * Internal function for creating append binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createAppendNodesBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
			return {
				bindingFunction: function(data) {
					var appendNodes = dataGetter(data);
					actualNode.innerHTML = '';
					if (typeof appendNodes !== 'undefined') {
						if (Array.isArray(appendNodes)) {
							for (var n = 0, nmax = appendNodes.length; n < nmax; n++) {
								actualNode.appendChild(appendNodes[n]);
							}
						} else {
							actualNode.appendChild(appendNodes);
						}
					}
				},
				rebindingFunction: function(data, boundNode) {
					var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
					var appendNodes = dataGetter(data);
					rebindNode.innerHTML = '';
					if (typeof appendNodes !== 'undefined') {
						if (Array.isArray(appendNodes)) {
							for (var n = 0, nmax = appendNodes.length; n < nmax; n++) {
								rebindNode.appendChild(appendNodes[n]);
							}
						} else {
							rebindNode.appendChild(appendNodes);
						}
					}
				}
			};
		}

		/**
		 * Internal function for creating inner HTML binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createInnerHtmlBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
			return {
				bindingFunction: function(data) {
					var htmlValue = dataGetter(data);
					if (typeof htmlValue !== 'undefined') {
						if (htmlValue !== null) {
							actualNode.innerHTML = htmlValue;
						} else {
							actualNode.innerHTML = '';
						}
					}
				},
				rebindingFunction: function(data, boundNode) {
					var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
					var htmlValue = dataGetter(data);
					if (typeof htmlValue !== 'undefined') {
						if (htmlValue !== null) {
							rebindNode.innerHTML = htmlValue;
						} else {
							rebindNode.innerHTML = '';
						}
					}
				}
			};
		}

		/**
		 * Internal function for creating text content binding (called from bindingFactory)
		 * @param {Node} actualNode - the actual node to bind to
		 * @param {Function} dataGetter - the created data getter function
		 * @param {String} cssSelector - the css selector (binding selector)
		 * @returns {*} object containing binding and rebinding functions
		 */
		function createTextContentBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
			return {
				bindingFunction: function(data) {
					var textValue = dataGetter(data);
					if (typeof textValue !== 'undefined') {
						if (textValue !== null) {
							actualNode.textContent = textValue;
						} else {
							actualNode.textContent = '';
						}
					}
				},
				rebindingFunction: function(data, boundNode) {
					var rebindNode = (cssSelector ? boundNode.querySelector(cssSelector) : boundNode);
					var textValue = dataGetter(data);
					if (typeof textValue !== 'undefined') {
						if (textValue !== null) {
							rebindNode.textContent = textValue;
						} else {
							rebindNode.textContent = '';
						}
					}
				}
			};
		}

		/**
		 * Utility function to get a node from the template using the specified css selector
		 * Also checks that the given selector selects exactly one node
		 * @param {string} selector - the css selector
		 * @returns {node} the selected node
		 */
		function getActualNode(selector) {
			var result;
			try {
				result = (selector ? templateNode.querySelectorAll(selector) : [templateNode]);
			} catch (e) {
				throw new TypeError("Binder constructor: Binding selector '" + selector + "' caused exception! (" + e + ")");
			}
			if (result.length > 1) {
				// too many nodes...
				throw new TypeError("Binder constructor: Binding selector '" + selector + "' returns multiple nodes from template!");
			} else if (result.length === 0) {
				// no nodes found...
				throw new TypeError("Binder constructor: Binding selector '" + selector + "' does not locate node in template!");
			}
			return result[0];
		}

		/**
		 * Utility function for stripping special end tokens off of the end of the css selector
		 * @param {string} selector - the css selector to be stripped
		 * @param {string} token - the token to be stripped off the end
		 * @returns {string} the css selector with the token removed
		 */
		function stripEndToken(selector, token) {
			return selector.substr(0, selector.length - token.length).trim();
		}

		/**
		 * Utility function to remove child '>' path selector from a css selector (if there is one)
		 * @param {string} selector - the css selector to be stripped
		 * @returns {string} the css selector with ending > removed
		 */
		function stripEndChildSelector(selector) {
			var result = selector.trim();
			return (result.substr(result.length - 1) === '>' ? result.substr(0, result.length - 1) : result).trim();
		}

		/**
		 * Creates a data getter function for use in bindings
		 * @param {string|function} instruction - the binding instruction
		 * @param {string} selector - the css selector (only used for reporting errors)
		 * @returns {function} the data getter function
		 */
		function createDataGetter(/*function|string*/instruction, /*string*/selector) {
			var result;
			if (typeof instruction === 'function') {
				result = instruction.bind(functionScope);
			} else if (typeof instruction === 'string') {
				result = templatedStringFunctionBuilder(instruction);
			} else {
				throw new TypeError("Binder constructor: Binding instruction for selector '" + selector + "' must be a string or function!");
			}
			return result;
		}

		/**
		 * Creates a function equivalent of the binding instruction (which may be a templated string expression)
		 * @param {string} instruction - the binding instruction
		 * @returns {function} the generated function
		 */
		function templatedStringFunctionBuilder(instruction) {
			function buildCatch(/*string*/expr, /*string*/objName) {
				var catchBit = ['catch(e){'];
				if (bindWarnings) {
					catchBit.push('console.warn("Binding instruction expression \'', expr,
						'\' failed to retrieve value from ",', objName,
						'," actual exception: ",e);'
					);
				}
				catchBit.push('return "";}');
				return catchBit.join('');
			}
			var curliesRegex = /{{\s*([^}]+)\s*}}/g;
			var result;
			// see if there are any curlies, e.g. {{propertyname}}, in the instruction...
			if (instruction.match(curliesRegex)) {
				// there are curlies in the instruction - so pick the instruction apart and create functions for each part...
				var concatBuilder = [];
				var lastEnd = 0;
				var match;
				while (match = curliesRegex.exec(instruction)) {
					if (match.index > lastEnd) {
						// there wes some string before this curlies...
						concatBuilder.push('"' + match.input.substring(lastEnd, match.index).replace(/"/g, '\\"') + '"');
					}
					if (match[1].substr(0,1) === '$') {
						// it's an expression...
						concatBuilder.push('(function(){try{return ' + match[1].substr(1) + ';}' + buildCatch(match[1], 'data') + '}).bind(this)()');
					} else if (match[1].substr(0, 'this.'.length) === 'this.') {
						// build a function around the reference to 'this'...
						concatBuilder.push('(function(d,self){try{return self.' + match[1].substr(5) + ';}' + buildCatch(match[1], 'self') +'})(data,this)');
					} else {
						// build function that grabs the specified property (wrapped in a try/catch to protect against any part of the property not being defined)...
						concatBuilder.push('(function(d){try{return d' + dotNotation2SquareBrackets(match[1]) + ';}' + buildCatch(match[1], 'd') + '})(data)');
					}
					lastEnd = match.index + match[0].length;
				}
				if (lastEnd < instruction.length) {
					// make sure we grab any of the original string after the last curlies...
					concatBuilder.push('"' + instruction.substr(lastEnd).replace(/"/g, '\\"') + '"');
				}
				// build the final function with all the concats of fixed strings and data property functions...
				result = eval('(function(data){return ' + concatBuilder.join('+') + ';})').bind(bindingsScope);
			} else {
				// no curlies - so assume it's just one property from the data (or this or an expression)...
				if (instruction.substr(0,1) === '$') {
					// it's an expression...
					result = eval('(function(data){try{return ' + instruction.substr(1) + ';}' + buildCatch(instruction.substr(1), 'data') + '})').bind(bindingsScope);
				} else if (instruction.substr(0, 'this.'.length) === 'this.') {
					// build a function around the reference to 'this'...
					result = eval('(function(data){try{return ' + instruction + ';}' + buildCatch(instruction, 'this') + '})').bind(bindingsScope);
				} else {
					// build a function to return the property (wrapped in a try/catch to protect against any part of the property not being defined)...
					result = eval('(function(data){try{return data' + dotNotation2SquareBrackets(instruction) + ';}' + buildCatch(instruction, 'data') + '})').bind(bindingsScope);
				}
			}
			return result;
		}

		/**
		 * Helper function - converts property dot notations to square brackets
		 * @param instruction - the original property (binding instruction or part of)
		 * @returns {string} the properties with . nottation converted to square brackets
		 */
		function dotNotation2SquareBrackets(instruction) {
			if (instruction.indexOf('.') !== -1) {
				var ptys = instruction.split('.');
				var builder = [];
				for (var i = 0, imax = ptys.length; i < imax; i++) {
					builder.push('[\'' + ptys[i] + '\']');
				}
				return builder.join('');
			} else {
				return '[\'' + instruction + '\']';
			}
		}

		/**
		 * Creates the reset functions - used to reset attributes on cookie cutting node back to their original values
		 * @param {Node} node - the node to be reset
		 * @param {string} selector - the css selector (to find the same node in the original)
		 * @param {string} attributeName - the name of the attribute to be reset
		 * @param {boolean} noRebind - whether the binding is not to be used when rebinding
		 */
		function createResetFunction(node, selector, attributeName, noRebind) {
			// we only want one resetter for each selector and attribute...
			var resetKey = selector + '@' + attributeName;
			if (!uniqueResetsMap.hasOwnProperty(resetKey)) {
				var originalNode = (selector ? resetNode.querySelector(selector) : resetNode);
				var resetFunction,rebindResetFunction;
				switch (attributeName) {
					case 'class':
						resetFunction = function() {
							node.className = originalNode.className;
						};
						rebindResetFunction = function(boundNode) {
							var actualNode = (selector ? boundNode.querySelector(selector) : boundNode);
							actualNode.className = originalNode.className;
						};
						break;
					case 'style':
						resetFunction = function() {
							node.style.cssText = originalNode.style.cssText;
						};
						rebindResetFunction = function(boundNode) {
							var actualNode = (selector ? boundNode.querySelector(selector) : boundNode);
							actualNode.style.cssText = originalNode.style.cssText;
						};
						break;
					default:
						// just restore the attribute...
						resetFunction = function() {
							if (!originalNode.hasAttribute(attributeName)) {
								node.removeAttribute(attributeName);
							} else {
								node.setAttribute(attributeName, originalNode.getAttribute(attributeName));
							}
						};
						rebindResetFunction = function(boundNode) {
							var actualNode = (selector ? boundNode.querySelector(selector) : boundNode);
							if (originalNode.hasAttribute(attributeName)) {
								actualNode.hasAttribute(attributeName, originalNode.getAttribute(attributeName));
							} else {
								actualNode.removeAttribute(attributeName);
							}
						};
				}
				// we won't need any more resets on this node and attribute...
				uniqueResetsMap[resetKey] = true;
				if (resetFunction) {
					resetFunctions.push(resetFunction);
					if (rebindResetFunction && !noRebind) {
						rebindingResetFunctions.push(rebindResetFunction);
					}
				}
			}
		}

		/**
		 * Utilty function to determine if a given object is a HTML Element node
		 * @param {object} obj - the object to be checked
		 * @returns [boolean] true if the object is an HTML Element
		 */
		function isElement(obj) {
			return (
				typeof HTMLElement === 'object' ? obj instanceof HTMLElement : //DOM2
					obj && typeof obj === 'object' && obj !== null && obj.nodeType === 1 && typeof obj.nodeName === 'string'
			);
		}

		/**
		 * Adds an event binding
		 * @param {object} eventInfo - the object containing info about the event binding
		 *         which will have the following properties:-
		 *           {
		 *             eventName: [string],
		 *             eventFunction: [function],
		 *             cssSelector: [string]
		 *           }
		 *         where:-
		 *           eventName - is the name of the event (e.g. 'click', 'keydown' etc.)
		 *           eventFunction - is the function to be called (the listener)
		 *           cssSelector - is the css selector to find the precise node within the bound node
		 * @param {Node} boundNode - the bound node (to have event bound to)
		 */
		function addEventBinding(/*object*/eventInfo, /*node*/boundNode) {
			var eventNode = (eventInfo.cssSelector ? boundNode.querySelector(eventInfo.cssSelector) : boundNode);
			// only listen for event if the node was found...
			if (eventNode) {
				eventNode.addEventListener(eventInfo.eventName, function(evt) {
					// get the current data from the bound node...
					var data = boundNode.$boundData;
					// and call the event binding function (with extra info)...
					return eventInfo.eventFunction(evt, boundNode, eventNode, data);
				});
			} else if (bindWarnings) {
				// warn of not found event binding node...
				console.warn("Event binding selector '" + eventInfo.cssSelector + "' - could not find node");
			}
		}

		/**
		 * Adds all the event bindings to the specified node
		 * @param {Node} boundNode - the node to add event bindings to
		 */
		function addEventBindings(/*node*/boundNode) {
			for (var e = 0, emax = eventBindings.length; e < emax; e++) {
				addEventBinding(eventBindings[e], boundNode);
			}
		}

		/**
		 * Performs all the reset functions
		 */
		function performResets() {
			for (var r = 0, rmax = resetFunctions.length; r < rmax; r++) {
				resetFunctions[r]();
			}
		}

		/**
		 * Performs all the binding functions
		 * @param {object} data - the data to be bound
		 */
		function performBindings(/*object*/data) {
			for (var b = 0, bmax = bindingFunctions.length; b < bmax; b++) {
				bindingFunctions[b](data);
			}
		}

		/**
		 * Performs all the post clone property binding functions
		 * @param {object} data - the data to be bound
		 * @param {Node} boundNode - the node to bind data to
		 */
		function performPostClonePropertyBindings(/*object*/data, /*node*/boundNode) {
			for (var pc = 0, pcmax = postClonePropertyBindings.length; pc < pcmax; pc++) {
				postClonePropertyBindings[pc](data, boundNode);
			}
		}

		/**
		 * Performs all the rebinding reset functions
		 * @param {Node} boundNode - the node to reset
		 */
		function performRebindingResets(/*node*/boundNode) {
			for (var r = 0, rmax = rebindingResetFunctions.length; r < rmax; r++) {
				rebindingResetFunctions[r](boundNode);
			}
		}

		/**
		 * Performs all the rebinding functions
		 * @param {object} data - the data to be bound
		 * @param {Node} boundNode - the node to bind data to
		 */
		function performRebindings(/*object*/data, /*node*/boundNode) {
			for (var b = 0, bmax = rebindingFunctions.length; b < bmax; b++) {
				rebindingFunctions[b](data, boundNode);
			}
		}

		/**
		 * Performs the firing of the after bound event (as specified by @event.bound)
		 * @param {object} data - the data that was bound
		 * @param {Node} boundNode - the node that the data was bound to
		 */
		function performAfterBoundEventFiring(/*object*/data, /*node*/boundNode) {
			// fire the after bind event (if it was specified)...
			if (afterBindEvent) {
				afterBindEvent(document.createEvent("event"), boundNode, boundNode, data);
			}
		}

		/**
		 * Performs adding the bound data as '$bondData' property on the bound node
		 * @param {object} data - the bound data
		 * @param {Node} boundNode - the node to set the $boundData property on
		 */
		function performSetNodeBoundDataProperty(/*object*/data, /*node*/boundNode) {
			boundNode.$boundData = data;
		}

		/**
		 * bind(data)
		 * (for cookie cutter style binding)
		 *
		 * Revealed (public) Function
		 * Binds data to the template and returns the final node
		 * @param {object} data - the data to be bound
		 * @returns {Node} the finally bound node
		 */
		function bind(data) {
			performResets();
			performBindings(data);
			// do the actual populating of the data...
			// create the actual bound node from the now populated template...
			var finalNode = templateNode.cloneNode(true);
			performSetNodeBoundDataProperty(data, finalNode);
			performPostClonePropertyBindings(data, finalNode);
			// add event bindings to created node...
			addEventBindings(finalNode);
			performAfterBoundEventFiring(data, finalNode);
			return finalNode;
		}

		/**
		 * rebind(data, node)
		 * (for cookie cutter style binding)
		 *
		 * Revealed (public) Function
		 * Re-binds data to an existing bound node
		 * @param {object} data - the new data to be bound
		 * @param {Node} node - the existing node
		 * @returns {Node} the re-bound node
		 */
		function rebind(data, node) {
			performRebindingResets(node);
			performRebindings(data, node);
			performPostClonePropertyBindings(data, node);
			performSetNodeBoundDataProperty(data, node);
			performAfterBoundEventFiring(data, node);
			return node;
		}

		/**
		 * bind(data)
		 * (for in-place style binding)
		 *
		 * Revealed (public) Function
		 * Binds/rebinds data to the in-place node
		 * @param {object} data - the data to be bound. If omitted, the existing bound data (which may have been updated) is
		 *        re-bound
		 * @returns {Node} the bound node
		 */
		function inplaceBind(data) {
			return inplaceRebind(data);
		}

		/**
		 * rebind(data)
		 * (for in-place style binding)
		 *
		 * Revealed (public) Function
		 * Binds/rebinds data to the in-place node
		 * @param {object} data - the data to be bound - if omitted, the existing bound data (which may have been updated) is
		 *        re-bound
		 * @returns {Node} the bound node
		 */
		function inplaceRebind(data) {
			// decide whether to re-use the bound data property on the node or the data argument passed...
			var useData = (arguments.length > 0 ? data : templateNode.$boundData);
			performResets();
			performBindings(useData);
			// add the current data as a property of the in-place node...
			performSetNodeBoundDataProperty(useData, templateNode);
			performAfterBoundEventFiring(useData, templateNode);
			return templateNode;
		}

		/**
		 * Gets the bound data from a bound node
		 *
		 * Just reads the $boundData property of the node - function provided so that user doesn't have to
		 * remember the special property name
		 * @param {Node} node - the node (top level) containing the bound data
		 * @returns object - the bound data
		 */
		function getBoundData(/*[node]*/node) {
			if (inplace) {
				return templateNode.$boundData;
			} else {
				return node.$boundData;
			}
		}

		// return the revealed functions (according to template type - cookie cutter or in-place)
		return {
			'bind': (inplace ? inplaceBind : bind),
			'rebind': (inplace ? inplaceRebind : rebind),
			'getBoundData': getBoundData,
			'isInplace': inplace
		};
	}

	// return constructor function from factory...
	return Binder;
}));