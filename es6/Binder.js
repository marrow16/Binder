export const BindingDefaults = {
    bindWarnings: false,
    compileWarnings: false
};

export const INPLACE = true;
export const CUTTER = false;

export class Binder {
    constructor(/*DOMElement | string*/template, /*object*/bindings,
                /*[object]*/ bindingsScope, /*[boolean]*/ inplace,
                /*[object]*/ options) {
        this.inplace = (typeof inplace === 'boolean') && inplace;
        this.functionScope = (bindingsScope !== null && typeof bindingsScope === 'object' ? bindingsScope : (bindingsScope === 'this' ? this : bindings));
        if (options != null && typeof options === 'object') {
            this.bindWarnings = typeof options.bindWarnings === 'boolean' ? options.bindWarnings : false;
            this.compileWarnings = typeof options.compileWarnings === 'boolean' ? options.compileWarnings : false;
        } else {
            this.bindWarnings = BindingDefaults.bindWarnings;
            this.compileWarnings = BindingDefaults.compileWarnings;
        }

        if (this.inplace) {
            // it's an inplace binder - so the node argument must be an DOM HTML Element...
            if (!isElement(template)) {
                throw new TypeError("Binder constructor: In-place binder argument 'template' must be an existing DOM HTMLElement!");
            }
            this.templateNode = template;
            this.resetNode = template.cloneNode(true);
        } else {
            // it's a cookie-cutter binder...
            if (typeof template === 'string') {
                // template defined as a string - create a node out of it...
                var fragment = document.createElement('div');
                fragment.innerHTML = template;
                this.resetNode = fragment.firstElementChild;
            } else if (isElement(template)) {
                if ('content' in template) {
                    // it's a HTML <template>...
                    this.resetNode = document.importNode(template.content, true).firstElementChild;
                } else {
                    this.resetNode = template;
                }
            } else {
                throw new TypeError("Binder constructor: Argument 'template' must be a string or DOM HTMLElement!");
            }
            // the actual template used (that will have nodes populated by selectors) is a clone of the supplied template...
            this.templateNode = this.resetNode.cloneNode(true);
        }

        this.bindings = new Bindings(bindings, this.inplace, this.functionScope,
            this.resetNode, this.templateNode,
            this.bindWarnings, this.compileWarnings);

    }

    get inPlace() {
        return this.inplace;
    }

    getBoundData(/*[node*]*/node) {
        if (this.inplace) {
            return this.templateNode.$boundData;
        } else {
            return node.$boundData;
        }
    }

    bind(data) {
        if (this.inplace) {
            this.bindings.inplaceBind(data);
            return this.templateNode;
        } else {
            return this.bindings.bind(data);
        }
    }

    rebind(data, node) {
        if (this.inplace) {
            return this.bind(data);
        } else {
            return this.bindings.rebind(data, node);
        }
    }

}

class Bindings {
    constructor(bindings, inplace, functionScope,
                resetNode, templateNode,
                bindWarnings, compileWarnings) {
        this.inplace = inplace;
        this.functionScope = functionScope;
        this.bindWarnings = bindWarnings;
        this.compileWarnings = compileWarnings;
        this.resetNode = resetNode;
        this.templateNode = templateNode;

        this.bindingFunctions = []; // actual binding functions
        this.postClonePropertyBindings = []; // binding functions that must be run after cloning
        this.rebindingFunctions = [];
        this.rebindingResetFunctions = [];
        this.eventBindings = []; // list of event bindings
        this.resetFunctions = [];
        this.uniqueResetsMap = {}; // map of selectors to avoid creating duplicate resets
        this.afterBindEvent; // any @event.bound event specified

        for (var pty in bindings) {
            if (bindings.hasOwnProperty(pty)) {
                this.bindingFactory(pty, bindings[pty]);
            }
        }
        if (this.inplace) {
            // it's an in-place binder, so add the event bindings now...
            this.addEventBindings(this.templateNode);
        }

    }

    bind(data) {
        this.performResets();
        this.performBindings(data);
        // do the actual populating of the data...
        // create the actual bound node from the now populated template...
        let finalNode = this.templateNode.cloneNode(true);
        this.performSetNodeBoundDataProperty(data, finalNode);
        this.performPostClonePropertyBindings(data, finalNode);
        // add event bindings to created node...
        this.addEventBindings(finalNode);
        this.performAfterBoundEventFiring(data, finalNode);
        return finalNode;
    }

    rebind(data, node) {
        this.performRebindingResets(node);
        this.performRebindings(data, node);
        this.performPostClonePropertyBindings(data, node);
        this.performSetNodeBoundDataProperty(data, node);
        this.performAfterBoundEventFiring(data, node);
        return node;
    }

    inplaceBind(data) {
        // decide whether to re-use the bound data property on the node or the data argument passed...
        let useData = (arguments.length > 0 ? data : this.templateNode.$boundData);
        this.performResets();
        this.performBindings(useData);
        // add the current data as a property of the in-place node...
        this.performSetNodeBoundDataProperty(useData, this.templateNode);
        this.performAfterBoundEventFiring(useData, this.templateNode);
        return this.templateNode;
    }

    /**
     * Performs all the reset functions
     */
    performResets() {
        this.resetFunctions.forEach(resetFunction => resetFunction());
    }

    /**
     * Performs all the binding functions
     * @param {object} data - the data to be bound
     */
    performBindings(/*object*/data) {
        this.bindingFunctions.forEach(bindingFunction => bindingFunction(data));
    }

    /**
     * Performs adding the bound data as '$bondData' property on the bound node
     * @param {object} data - the bound data
     * @param {Node} boundNode - the node to set the $boundData property on
     */
    performSetNodeBoundDataProperty(/*object*/data, /*node*/boundNode) {
        boundNode.$boundData = data;
    }

    /**
     * Performs the firing of the after bound event (as specified by @event.bound)
     * @param {object} data - the data that was bound
     * @param {Node} boundNode - the node that the data was bound to
     */
    performAfterBoundEventFiring(/*object*/data, /*node*/boundNode) {
        // fire the after bind event (if it was specified)...
        if (this.afterBindEvent) {
            this.afterBindEvent(document.createEvent("event"), boundNode, boundNode, data);
        }
    }

    /**
     * Performs all the post clone property binding functions
     * @param {object} data - the data to be bound
     * @param {Node} boundNode - the node to bind data to
     */
    performPostClonePropertyBindings(/*object*/data, /*node*/boundNode) {
        this.postClonePropertyBindings.forEach(propertyBinding => propertyBinding(data, boundNode));
    }

    /**
     * Performs all the rebinding reset functions
     * @param {Node} boundNode - the node to reset
     */
    performRebindingResets(/*node*/boundNode) {
        this.rebindingResetFunctions.forEach(rebindReset => rebindReset(boundNode));
    }

    /**
     * Performs all the rebinding functions
     * @param {object} data - the data to be bound
     * @param {Node} boundNode - the node to bind data to
     */
    performRebindings(/*object*/data, /*node*/boundNode) {
        this.rebindingFunctions.forEach(rebinder => rebinder(data, boundNode));
    }

    /**
     * Adds all the event bindings to the specified node
     * @param {Node} boundNode - the node to add event bindings to
     */
    addEventBindings(/*node*/boundNode) {
        this.eventBindings.forEach(eventBinding => this.addEventBinding(eventBinding, boundNode));
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
    addEventBinding(/*object*/eventInfo, /*node*/boundNode) {
        let eventNodes = (eventInfo.cssSelector ? boundNode.querySelectorAll(eventInfo.cssSelector) : [boundNode]);
        if (eventNodes.length === 0 && this.bindWarnings) {
            // warn of not found event binding node...
            console.warn("Event binding selector '" + eventInfo.cssSelector + "' - could not find any node(s)");
        }
        eventNodes.forEach(function(eventNode) {
            eventNode.addEventListener(eventInfo.eventName, function(evt) {
                // get the current data from the bound node...
                var data = boundNode.$boundData;
                // and call the event binding function (with extra info)...
                return eventInfo.eventFunction(evt, boundNode, eventNode, data);
            });
        });
    }

    bindingFactory(/*string*/bindingSelector, /*function|object|string*/bindingInstruction) {
        if (typeof bindingInstruction === 'object') {
            // the instruction is an object - so treat each child property as a descendant selector & instruction of the current selector...
            for (var pty in bindingInstruction) {
                if (bindingInstruction.hasOwnProperty(pty)) {
                    // watch out for '!' at start of sub-selectors...
                    if (pty.substr(0,1) === '!') {
                        this.bindingFactory((bindingSelector.substr(0,1) === '!' ? '' : '!') + bindingSelector + ' ' + pty.substr(1), bindingInstruction[pty]);
                    } else {
                        this.bindingFactory(bindingSelector + ' ' + pty, bindingInstruction[pty]);
                    }
                }
            }
            // we're done now, the descendant bindings will have been created...
            return;
        }

        let cssSelector = bindingSelector.trim();
        let noRebind = false;
        if (cssSelector.substr(0,1) === '!') {
            // the selector starts with an exclamation mark - which means it's not to be used for rebindig...
            cssSelector = cssSelector.substr(1).trim();
            noRebind = true;
            if (this.inplace && this.compileWarnings) {
                console.warn("Binder constructor: Once only binding selector '!" + cssSelector + "' ignored for in-place binders");
            }
        }
        if (cssSelector.substr(0,1) === '>') {
            cssSelector = ':scope ' + cssSelector;
        }

        // create the data getter for the binding...
        let dataGetter = this.createDataGetter(bindingInstruction, cssSelector);

        let actualNodes;
        let addBindings;
        let binding;
        let cssSelectorsList = [cssSelector];
        if (cssSelector.indexOf(',') > -1) {
            if (cssSelector.substring(0,1) === '(') {
                // TODO check parenthesis balance?
                var afterGroup = cssSelector.substring(cssSelector.lastIndexOf(')') + 1).trim();
                cssSelector = cssSelector.substring(1, cssSelector.lastIndexOf(')'));
                cssSelectorsList = cssSelector.split(',');
                if (afterGroup) {
                    for (var i = 0, imax = cssSelectorsList.length; i < imax; i++) {
                        cssSelectorsList[i] += ' ' + afterGroup;
                    }
                }
            } else {
                cssSelectorsList = cssSelector.split(',');
            }
        }
        cssSelectorsList.forEach(cssSelector => {
            addBindings = [];
            if (cssSelector.indexOf('@') !== -1) {
                // there is an attribute or event specifier on the end of the selector...
                var selectorParts = cssSelector.split('@');
                if (selectorParts.length !== 2) {
                    throw new TypeError("Binder constructor: Binding selector '" + cssSelector + "' contains multiple attribute/event tokens!");
                }
                cssSelector = stripEndChildSelector(selectorParts[0]);
                actualNodes = this.getActualNodes(cssSelector);
                var attributeToken = selectorParts[1].trim();
                var attributeTokenParts = attributeToken.split('.');
                if (attributeTokenParts.length === 1) {
                    // it's just an attribute value setter...
                    actualNodes.forEach(actualNode => addBindings.push(this.createAttributeSetBinding(actualNode, dataGetter, cssSelector, attributeToken)));
                } else if (attributeTokenParts.length === 2) {
                    var attributeSubInstruction = attributeTokenParts[1].trim();
                    attributeToken = attributeTokenParts[0].trim();
                    switch (attributeToken) {
                        case 'property':
                        case 'pty':
                            actualNodes.forEach(actualNode => addBindings.push(this.createPropertyBinding(actualNode, dataGetter, cssSelector, attributeSubInstruction)));
                            break;
                        case 'class':
                            actualNodes.forEach(actualNode => {
                                this.createResetFunction(actualNode, cssSelector, attributeToken, noRebind);
                                switch (attributeSubInstruction) {
                                    case 'add':
                                        addBindings.push(binding = this.createClassAddBinding(actualNode, dataGetter, cssSelector));
                                        break;
                                    case 'remove':
                                        addBindings.push(binding = this.createClassRemoveBinding(actualNode, dataGetter, cssSelector));
                                        break;
                                    default:
                                        throw new TypeError("Binder constructor: Binding selector '" + cssSelector + "@" + attributeToken + "." + attributeSubInstruction + "' is invalid - @class attribute can only have sub-instructions of '.add' or '.remove'!");
                                }
                            });
                            break;
                        case 'dataset':
                            actualNodes.forEach(actualNode => addBindings.push(this.createDatasetBinding(actualNode, dataGetter, cssSelector, attributeSubInstruction)));
                            break;
                        case 'style':
                            actualNodes.forEach(actualNode => {
                                this.createResetFunction(actualNode, cssSelector, attributeToken, noRebind);
                                addBindings.push(this.createStyleBinding(actualNode, dataGetter, cssSelector, attributeSubInstruction));
                            });
                            break;
                        case 'event':
                            // for events the binding instruction must be a function...
                            if (typeof bindingInstruction !== 'function' && !this.isFunctionInstruction(bindingInstruction)) {
                                throw TypeError("Binder constructor: Event binding instruction for selector '" + cssSelector + "@" + attributeToken + "." + attributeSubInstruction + "' must be a function!");
                            }
                            if (attributeSubInstruction === 'bound') {
                                if (this.afterBindEvent) {
                                    throw TypeError("Binder constructor: Only one 'bound' event can be specified!");
                                }
                                this.afterBindEvent = dataGetter;
                            } else {
                                // add the event binding...
                                this.eventBindings.push({
                                    eventName: attributeSubInstruction,
                                    cssSelector: cssSelector,
                                    eventFunction: dataGetter // we use the bound function rather than the original function
                                });
                            }
                            break;
                        default:
                            actualNodes.forEach(actualNode => {
                                // the only allowed sub-instruction on all attributes is '.remove'...
                                this.createResetFunction(actualNode, cssSelector, attributeToken, noRebind);
                                if (attributeSubInstruction === 'remove') {
                                    if (typeof bindingInstruction !== 'function' && !this.isFunctionInstruction(bindingInstruction)) {
                                        if (this.compileWarnings) {
                                            console.warn("Binder constructor: Attribute remove '" + cssSelector + "' - usually expects function as binding instruction");
                                        }
                                    }
                                    addBindings.push(this.createRemoveAttributeBinding(actualNode, dataGetter, cssSelector, attributeToken));
                                } else {
                                    throw new TypeError("Binder constructor: Binding selector '" + cssSelector + "@" + attributeToken + "." + attributeSubInstruction + "' is invalid - only @class, @event, @dataset and @style attributes can have sub-instructions!");
                                }
                            });
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
                actualNodes = this.getActualNodes(cssSelector);
                actualNodes.forEach(actualNode => addBindings.push(this.createAppendNodesBinding(actualNode, dataGetter, cssSelector)));
            } else if (cssSelector.substr(0 - '#innerHTML'.length) === '#innerHTML') {
                // it's an inner HTML instruction...
                cssSelector = stripEndChildSelector(stripEndToken(cssSelector, '#innerHTML'));
                actualNodes = this.getActualNodes(cssSelector);
                actualNodes.forEach(actualNode => addBindings.push(this.createInnerHtmlBinding(actualNode, dataGetter, cssSelector)));
            } else {
                // it's a text content instruction...
                // the selector may or may not end with an explicit '#textContent' token...
                cssSelector = stripEndChildSelector((cssSelector.substr(0 - '#textContent'.length) === '#textContent' ? stripEndToken(cssSelector, '#textContent') : cssSelector));
                actualNodes = this.getActualNodes(cssSelector);
                actualNodes.forEach(actualNode => addBindings.push(this.createTextContentBinding(actualNode, dataGetter, cssSelector)));
            }
            // add the bindings function to the list...
            addBindings.forEach(binding => {
                if (binding.nonCloneable) {
                    this.postClonePropertyBindings.push(binding.bindingFunction);
                } else {
                    this.bindingFunctions.push(binding.bindingFunction);
                }
                if (binding.rebindingFunction && !noRebind) {
                    this.rebindingFunctions.push(binding.rebindingFunction);
                }
            });
        });

    }

    /**
     * Creates a data getter function for use in bindings
     * @param {string|function} instruction - the binding instruction
     * @param {string} selector - the css selector (only used for reporting errors)
     * @returns {function} the data getter function
     */
    createDataGetter(/*function|string*/instruction, /*string*/selector) {
        let result;
        if (typeof instruction === 'function') {
            result = instruction.bind(this.functionScope);
        } else if (typeof instruction === 'string') {
            if (instruction.substr(0,1) === '.') {
                if (instruction.substr(-2, 2) === '()') {
                    let funcName = instruction.substr(1,instruction.length - 3);
                    if (typeof this.functionScope[funcName] === 'function') {
                        return this.functionScope[funcName];
                    }
                    throw new TypeError("Binder constructor: Binding instruction for selector '" + selector + "' - the function/method '" + funcName + "' does not exist in the bindingsScope!");
                } else {
                    let ptyName = instruction.substr(1);
                    if (ptyName in this.functionScope) {
                        return eval('(function(data){return this.' + ptyName + ';})').bind(this.functionScope);
                    }
                    throw new TypeError("Binder constructor: Binding instruction for selector '" + selector + "' - the property '" + ptyName + "' does not exist in the bindingsScope!");
                }
            }
            result = this.templatedStringFunctionBuilder(instruction);
        } else {
            throw new TypeError("Binder constructor: Binding instruction for selector '" + selector + "' must be a string or function!");
        }
        return result;
    }

    isFunctionInstruction(/*function|string*/instruction) {
        if (typeof instruction === 'function') {
            return true;
        } else if (typeof instruction === 'string' && instruction.substr(0,1) === '.' && instruction.substr(-2, 2) === '()') {
            return true;
        }
        return false;
    }

    /**
     * Creates a function equivalent of the binding instruction (which may be a templated string expression)
     * @param {string} instruction - the binding instruction
     * @returns {function} the generated function
     */
    templatedStringFunctionBuilder(instruction) {
        //var curliesRegex = /{{\s*([^}]+)\s*}}/g;
        let curliesRegex = /\{([^}]+)\}/g;
        let result;
        // see if there are any curlies, e.g. {{propertyname}}, in the instruction...
        if (instruction.match(curliesRegex)) {
            // there are curlies in the instruction - so pick the instruction apart and create functions for each part...
            let concatBuilder = [];
            let lastEnd = 0;
            let match;
            while (match = curliesRegex.exec(instruction)) {
                if (match.index > lastEnd) {
                    // there wes some string before this curlies...
                    concatBuilder.push('"' + match.input.substring(lastEnd, match.index).replace(/"/g, '\\"') + '"');
                }
                if (match[1].substr(0,1) === '$') {
                    // it's an expression...
                    concatBuilder.push('(function(){try{return ' + match[1].substr(1) + ';}' + this.buildCatch(match[1], 'data') + '}).bind(this)()');
                } else if (match[1].substr(0, 'this.'.length) === 'this.') {
                    // build a function around the reference to 'this'...
                    concatBuilder.push('(function(d,self){try{return self.' + match[1].substr(5) + ';}' + this.buildCatch(match[1], 'self') +'})(data,this)');
                } else {
                    // build function that grabs the specified property (wrapped in a try/catch to protect against any part of the property not being defined)...
                    concatBuilder.push('(function(d){try{return d' + dotNotation2SquareBrackets(match[1]) + ';}' + this.buildCatch(match[1], 'd') + '})(data)');
                }
                lastEnd = match.index + match[0].length;
            }
            if (lastEnd < instruction.length) {
                // make sure we grab any of the original string after the last curlies...
                concatBuilder.push('"' + instruction.substr(lastEnd).replace(/"/g, '\\"') + '"');
            }
            // build the final function with all the concats of fixed strings and data property functions...
            let concatExpr = concatBuilder.join('+');
            result = eval('(function(data){return ' + concatExpr + ';})').bind(this.functionScope);
        } else {
            // no curlies - so assume it's just one property from the data (or this or an expression)...
            if (instruction.substr(0,1) === '$') {
                // it's an expression...
                result = eval('(function(data){try{return ' + instruction.substr(1) + ';}' + this.buildCatch(instruction.substr(1), 'data') + '})').bind(this.functionScope);
            } else if (instruction.substr(0, 'this.'.length) === 'this.') {
                // build a function around the reference to 'this'...
                result = eval('(function(data){try{return ' + instruction + ';}' + this.buildCatch(instruction, 'this') + '})').bind(this.functionScope);
            } else {
                // build a function to return the property (wrapped in a try/catch to protect against any part of the property not being defined)...
                result = eval('(function(data){try{return data' + dotNotation2SquareBrackets(instruction) + ';}' + this.buildCatch(instruction, 'data') + '})').bind(this.functionScope);
            }
        }
        return result;
    }

    /**
     * Utility method to build a catch for a data getter - so that if bindWarnings are turned on, any errors are console logged
     */
    buildCatch(/*string*/expr, /*string*/objName) {
        var catchBit = ['catch(e){'];
        if (this.bindWarnings) {
            catchBit.push('console.warn("Binding instruction expression \'', expr,
                '\' failed to retrieve value from ",', objName,
                '," actual exception: ",e);'
            );
        }
        catchBit.push('return "";}');
        return catchBit.join('');
    }

    /**
     * Utility method to get nodes from the template using the specified css selector
     * Also checks that the given selector selects at least  one node
     * @param {string} selector - the css selector
     * @returns {nodes} the selected nodes
     */
    getActualNodes(selector) {
        let result;
        try {
            result = (selector ? this.templateNode.querySelectorAll(selector) : [this.templateNode]);
        } catch (e) {
            throw new TypeError("Binder constructor: Binding selector '" + selector + "' caused exception! (" + e + ")");
        }
        if (result.length === 0) {
            // no nodes found...
            throw new TypeError("Binder constructor: Binding selector '" + selector + "' does not locate node in template!");
        }
        return result;
    }

    /**
     * Creates the reset functions - used to reset attributes on cookie cutting node back to their original values
     * @param {Node} node - the node to be reset
     * @param {string} selector - the css selector (to find the same node in the original)
     * @param {string} attributeName - the name of the attribute to be reset
     * @param {boolean} noRebind - whether the binding is not to be used when rebinding
     */
    createResetFunction(node, selector, attributeName, noRebind) {
        // we only want one resetter for each selector and attribute...
        let resetKey = selector + '@' + attributeName;
        if (!this.uniqueResetsMap.hasOwnProperty(resetKey)) {
            var originalNode = (selector ? this.resetNode.querySelector(selector) : this.resetNode);
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
            this.uniqueResetsMap[resetKey] = true;
            if (resetFunction) {
                this.resetFunctions.push(resetFunction);
                if (rebindResetFunction && !noRebind) {
                    this.rebindingResetFunctions.push(rebindResetFunction);
                }
            }
        }
    }

    /**
     * Internal method for creating attribute set binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @param {String} attributeName - the name of the attribute
     * @returns {*} object containing binding and rebinding functions
     */
    createAttributeSetBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/attributeName) {
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
     * Internal method for creating property binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @param {String} propertyName - the name of the property
     * @returns {*} object containing binding and rebinding functions
     */
    createPropertyBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/propertyName) {
        if (!this.inplace) {
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
     * Internal method for creating class add binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @returns {*} object containing binding and rebinding functions
     */
    createClassAddBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
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
     * Internal method for creating class remove binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @returns {*} object containing binding and rebinding functions
     */
    createClassRemoveBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
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
     * Internal method for creating dataset binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @returns {*} object containing binding and rebinding functions
     */
    createDatasetBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/dataName) {
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
     * Internal method for creating style binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @param {String} styleProperty - the style property name
     * @returns {*} object containing binding and rebinding functions
     */
    createStyleBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/styleProperty) {
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
     * Internal method for creating remove attribute binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @param {String} attributeName - the attribute name
     * @returns {*} object containing binding and rebinding functions
     */
    createRemoveAttributeBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector, /*string*/attributeName) {
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
     * Internal method for creating text content binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @returns {*} object containing binding and rebinding functions
     */
    createTextContentBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
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
     * Internal function for creating append binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @returns {*} object containing binding and rebinding functions
     */
    createAppendNodesBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
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
     * Internal method for creating inner HTML binding (called from bindingFactory)
     * @param {Node} actualNode - the actual node to bind to
     * @param {Function} dataGetter - the created data getter function
     * @param {String} cssSelector - the css selector (binding selector)
     * @returns {*} object containing binding and rebinding functions
     */
    createInnerHtmlBinding(/*node*/actualNode, /*function*/dataGetter, /*string*/cssSelector) {
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
 * Utility function to remove child '>' path selector from a css selector (if there is one)
 * @param {string} selector - the css selector to be stripped
 * @returns {string} the css selector with ending > removed
 */
function stripEndChildSelector(selector) {
    var result = selector.trim();
    return (result.substr(result.length - 1) === '>' ? result.substr(0, result.length - 1) : result).trim();
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
