// core framework functions

module.exports = function (config) {
	var events = require('events'),
		fs = require('fs'),
		handlebars = require('handlebars'),
		util = require('util'),
		methods = {

			public: {

				cachePatterns: function (path) {
					var patterns = {},
						patternFiles = fs.readdirSync(path),
						patternCount = patternFiles.length,
						patternName = '',
						viewContents = '',
						regex = new RegExp(/^([A-Za-z0-9-_])*$/);
					for ( var i = 0; i < patternCount; i += 1 ) {
						patternName = patternFiles[i];
						if ( regex.test(patternName) ) {
							try {
								viewContents = fs.readFileSync(path + '/' + patternName + '/' + patternName + '.html', { 'encoding': 'utf8' });
								viewContents = viewContents.replace(/[\n|\t|\r]/g, '');
								viewContents = viewContents.replace(/'/g, "\\'");
								patterns[patternName] = {
									model: require(path + "/" + patternName + "/" + patternName + "-model"),
									controller: require(path + "/" + patternName + "/" + patternName + "-controller"),
									view: {
										raw: viewContents,
										compiled: handlebars.compile(viewContents)
									}
								};
							} catch (e) {
								console.log(util.inspect(e));
							}
						}
					};
					return patterns;
				},

				chain: function (params, emitter, functions) {
					var emitters = {},
						firstProperty = {},
						firstPropertySet = false,
						previousProperty = {},
						output = {},
						ready = {};

					function chainTracker() {
						var allReady = true;

						for ( var property in ready ) {
							if ( ready[property] === false ) {
								allReady = false;
							}
						}

						if ( allReady ) {
							emitter.emit('ready', output);
						}
					};

					for ( var property in functions ) {
						ready[property] = false;
					};

					// TODO
					// Create an array containing the incoming functions and their 'ready' emitters in reverse order,
					// then loop over the array, firing each function and passing the next function (next index)
					// into the current function as a callback. At the end of the array, fire the final function
					// and pass the chain group 'ready' emitter as the final callback.

				},

				// The following copy(), extend(), and getValue() functions were inspired by (meaning mostly stolen from)
				// Andrée Hanson:
				// http://andreehansson.se/

				copy: function (object) {
					var objectCopy = {};

					for ( var property in object ) {
						objectCopy[property] = methods.private.getValue(object[property]);
					}

					return objectCopy;
				},

				extend: function (original, extension) {
					var mergedObject = methods.public.copy(original);

					for ( var property in extension ) {
						mergedObject[property] = methods.private.getValue(extension[property]);
					}

					return mergedObject;
				},

				groupListener: function (functions, callback) {
					var emitter = {},
						output = {},
						ready = {},
						groupTracker = function () {
							var allReady = true;

							for ( var property in ready ) {
								if ( ready[property] === false ) {
									allReady = false;
								}
							}

							if ( allReady && typeof callback !== 'undefined' ) {
								callback(output);
							}
						};

					for ( var property in functions ) {
						ready[property] = false;
					};

					for ( var property in functions ) {
						if ( functions[property]['controller'] ) {
							emitters = methods.public.mvcEmitterSet(property);
							emitters.controller.on('ready', function (result) {
								ready[this.name] = true;
								output[this.name] = result;
								groupTracker();
							});
							// A copy of args is passed in case it contains shared objects so
							// the original isn't polluted by changes made inside the pattern
							functions[property]['controller'](methods.public.copy(functions[property]['args']), emitters);
						} else {
							emitter = new events.EventEmitter();
							emitter['name'] = property;
							emitter.on('ready', function (result) {
								ready[this.name] = true;
								output[this.name] = result;
								groupTracker();
							});
							functions[property]['method'](methods.public.copy(functions[property]['args']), emitter);
						}
					};
				},

				isNumeric: function (n) {
				  return !isNaN(parseFloat(n)) && isFinite(n);
				},

				mvcEmitterSet: function (name) {
					var emitters = {};

					emitters.model = new events.EventEmitter();
					emitters.view = new events.EventEmitter();
					emitters.controller = new events.EventEmitter();
					emitters.controller.name = name;

					return emitters;
				},

				renderView: function (view, params) {
					var viewOutput = '';

					switch ( params.route.format ) {
						case 'html':
							viewOutput = app.patterns[view].view.compiled(params);
							break;
						case 'json':
							viewOutput = JSON.stringify(params.content);
							break;
					}

					return viewOutput;
				}
			},

			private: {

				getValue: function (obj) {
					var isArray = obj.constructor.toString().indexOf('Array') >= 0,
						isObject = obj.constructor.toString().indexOf('Object') >= 0,
						val,
						i = 0,
						l;

					if ( isArray ) {
						val = Array.prototype.slice.apply(obj);
						l = val.length;

						do {
							val[i] = methods.private.getValue(val[i]);
						} while (++i < l);
					} else if ( isObject ) {
						val = methods.public.copy(obj);
					} else {
						val = obj;
					}

					return val;
				}

			}
		};

	return methods.public;
};