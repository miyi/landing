/* ************************************************************************
 *  <copyright file="dagger.js" company="DAGGER TEAM">
 *  Copyright (c) 2016, 2023 All Right Reserved
 *
 *  THIS CODE AND INFORMATION ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY
 *  KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 *  IMPLIED WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A
 *  PARTICULAR PURPOSE.
 *  </copyright>
 *  ***********************************************************************/

export default ((
  { asserter, logger, warner } = ((
    messageFormatter = (message, normalStyle, specialStyle) => {
      const doubleQuotes = '"',
        offset = message.startsWith(doubleQuotes) ? 1 : 0,
        messages = [],
        styles = [];
      return (
        forEach(
          message.split(doubleQuotes).filter((snippet) => snippet),
          (snippet, index) =>
            (index + offset) % 2
              ? messages.push(`%c"${snippet}"`) && styles.push(specialStyle)
              : messages.push(`%c${snippet}`) && styles.push(normalStyle)
        ) || [messages.join(""), ...styles]
      );
    },
    vendor = (
      messages,
      condition,
      method,
      normalStyle,
      specialStyle,
      breaking = false
    ) => {
      if (condition) {
        return;
      }
      const messageSuffix = ", please double check.";
      if (Array.isArray(messages)) {
        const [message, ...objects] = messages,
          suffix = '%c"%o"',
          length = objects.length;
        let array = [],
          resolvedMessage = "";
        forEach(
          `${message}${messageSuffix}`.split('"%o"'),
          (snippet, index) => {
            const [message, ...formatter] = messageFormatter(
              snippet,
              normalStyle,
              specialStyle
            );
            resolvedMessage += message;
            array = [...array, ...formatter];
            if (index < length) {
              resolvedMessage += suffix;
              array = [...array, specialStyle, objects[index]];
            }
          }
        );
        method(resolvedMessage, ...array);
      } else {
        method(
          ...messageFormatter(
            `${messages}${messageSuffix}`,
            normalStyle,
            specialStyle
          )
        );
      }
      if (breaking) {
        throw new Error("dagger AssertionError occurred!");
      }
    }
  ) => ({
    asserter: (messages, condition) =>
      vendor(
        messages,
        condition,
        console.assert.bind(console, false),
        "color: #ff0000",
        "color: #b22222",
        true
      ),
    logger: (message) =>
      console.log(
        ...messageFormatter(message, "color: #337ab7", "color: #9442d0")
      ),
    warner: (messages, condition) =>
      vendor(
        messages,
        condition,
        console.warn,
        "color: #ff0000",
        "color: #b22222"
      ),
  }))(),
  context = Symbol("context"),
  currentController = null,
  daggerOptions = {
    integrity: true,
    rootSelectors: ["title", "body"],
    routing: {
      mode: "history",
      aliases: {},
      default: "",
      prefix: "",
      redirects: {},
      scenarios: {},
    },
  },
  directiveObjects = [],
  dispatchSource = { bubble: "bubble", self: "self", mutation: "mutation" },
  isRouterWritable = false,
  rootNamespace = null,
  rootNodeProfiles = [],
  rootScope = null,
  emptier = () => Object.create(null),
  processorCaches = emptier(),
  styleModuleSet = new Set(),
  forEach = (iterators, processor) => {
    if (!iterators) {
      return;
    }
    const length = iterators.length || 0;
    for (let index = 0; index < length; ++index) {
      processor(iterators[index], index);
    }
  },
  hashTableResolver = (...array) => {
    const hashTable = emptier();
    return forEach(array, (key) => (hashTable[key] = true)) || hashTable;
  },
  emptyObject = emptier(),
  htmlNodeContext = null,
  meta = Symbol("meta"),
  promisor = Promise.resolve(),
  resolvedType = {
    json: "json",
    namespace: "namespace",
    script: "script",
    style: "style",
    string: "string",
    template: "template",
  },
  routerTopology = null,
  sentrySet = new Set(),
  templateCacheMap = new WeakMap(),
  textNode = document.createTextNode(""),
  configResolver = (
    (
      defaultConfigContent = {
        template: {
          uri: ["#template"],
          type: resolvedType.template,
          style: "style",
          optional: true,
        },
        script: {
          uri: ['script[type="dagger/script"]'],
          type: resolvedType.script,
          optional: true,
        },
        style: {
          uri: ['style[type="dagger/style"]'],
          type: resolvedType.style,
          optional: true,
        },
      },
      configExtender = (base, content, extendsDefaultConfig) => ({
        base,
        content: extendsDefaultConfig
          ? Object.assign({}, defaultConfigContent, content)
          : content,
      })
    ) =>
    (baseElement, base) => {
      const configContainer = querySelector(
        baseElement,
        'script[type="dagger/configs"]',
        false,
        true
      );
      if (configContainer) {
        const src = configContainer.getAttribute("src"),
          extendsDefaultConfig = configContainer.hasAttribute("extends");
        configContainer.hasAttribute("base") &&
          (base = new URL(configContainer.getAttribute("base") || "", base)
            .href);
        return src
          ? remoteResourceResolver(
              new URL(src, base),
              configContainer.integrity
            ).then(({ content }) =>
              configExtender(
                base,
                functionResolver(`(${content})`),
                extendsDefaultConfig
              )
            )
          : configExtender(
              base,
              configContainer.textContent.trim()
                ? functionResolver(`(${configContainer.textContent})`)
                : {},
              extendsDefaultConfig
            );
      }
      return { base, content: defaultConfigContent };
    }
  )(),
  functionResolver = (expression) =>
    processorCaches[expression] ||
    (processorCaches[expression] = new Function(`return ${expression};`)()),
  isString = (object) => Object.is(typeof object, "string"),
  ownKeys = (target) =>
    Reflect.ownKeys(target).filter((key) => !Object.is(key, meta)),
  serializer = ([resolver, ...nextResolvers], token = { stop: false }) => {
    if (token.stop) {
      return;
    }
    if (resolver instanceof Promise) {
      return resolver.then((resolver) =>
        serializer([resolver, ...nextResolvers], token)
      );
    } else if (resolver instanceof Function) {
      return serializer([resolver(null, token), ...nextResolvers], token);
    } else {
      return nextResolvers.length
        ? serializer(
            [nextResolvers.shift()(resolver, token), ...nextResolvers],
            token
          )
        : resolver;
    }
  },
  originalStringifyMethod = JSON.stringify,
  originalSetAdd = Set.prototype.add,
  originalSetClear = Set.prototype.clear,
  originalSetDelete = Set.prototype.delete,
  originalMapClear = Map.prototype.clear,
  originalMapSet = Map.prototype.set,
  originalWeakMapSet = WeakMap.prototype.set,
  processorResolver = () => {
    if (!directiveObjects.length) {
      return;
    }
    forEach(
      functionResolver(
        `[${directiveObjects
          .map((directive) => directive.processor)
          .join(", ")}]`
      ),
      (processor, index) => {
        const directive = directiveObjects[index];
        processorCaches[directive.processor] = processor;
        directive.processor = processor;
      }
    );
    directiveObjects.length = 0;
  },
  processorWrapper = (originalMethod) =>
    function (...parameters) {
      const controller = currentController;
      currentController = null;
      const result = originalMethod.apply(this, parameters);
      currentController = controller;
      return result;
    },
  querySelector = (
    baseElement,
    selector,
    all = false,
    ignoreMismatch = false
  ) => {
    const element =
      baseElement[all ? "querySelectorAll" : "querySelector"](selector);
    ignoreMismatch ||
      asserter(
        `Failed to get element matched selector "${selector}"`,
        all ? element.length : element
      );
    return element;
  },
  remoteResourceResolver = (url, integrity = "", required = false) =>
    fetch(
      url,
      daggerOptions.integrity && integrity
        ? { integrity: `sha256-${integrity}` }
        : {}
    )
      .then((response) => {
        if (response.ok) {
          const type = response.headers.get("content-type");
          asserter(
            `Missing "content-type" for the response content of "${url}"`,
            type
          );
          return response.text().then((content) => ({ content, type }));
        } else {
          asserter(`Failed to fetch remote module from "${url}"`, !required);
        }
      })
      .catch(() => {
        const info = `Failed to fetch remote module from "${url}"`;
        required ? asserter(info) : warner(info);
      }),
  templateResolver = (content) => {
    const template = document.createElement("template");
    template.innerHTML = content;
    return template.content;
  },
  selectorInjector = (element, selectors) =>
    forEach(element.children, (child) => {
      if (Object.is(child.tagName, "TEMPLATE")) {
        child.getAttribute("$html") &&
          child.setAttribute("dg_scoped_styles", selectors.join(","));
        selectorInjector(child.content, selectors);
      } else if (child instanceof HTMLElement) {
        forEach(selectors, (selector) => child.setAttribute(selector, ""));
      }
    }),
  textResolver = (data, trim = true) => {
    if (!isString(data)) {
      if (data == null || Number.isNaN(data)) {
        return "";
      }
      if (data instanceof Object) {
        return originalStringifyMethod(data);
      }
      data = String(data);
    }
    return trim ? data.trim() : data;
  },
  proxyResolver = (
    (
      hasOwnProperty = Object.prototype.hasOwnProperty,
      invalidSymbols = new Set([
        ...Reflect.ownKeys(Symbol)
          .map((key) => Symbol[key])
          .filter((item) => Object.is(typeof item, "symbol")),
        context,
        meta,
      ]),
      resolvedDataMap = new WeakMap(),
      validConstructorSet = new Set([void 0, Array, Object]),
      proxyHandler = {
        get: (target, property) => {
          const value = target[property];
          if (
            currentController &&
            !invalidSymbols.has(property) &&
            (Object.is(value) || hasOwnProperty.call(target, property))
          ) {
            const topologySet = currentController.topologySet;
            forEach(
              [...target[meta]].filter(
                (topology) => !topology.parent || topologySet.has(topology)
              ),
              (topology) => topology.fetch(property, value).subscribe()
            );
          }
          return value;
        },
        set: (target, property, newValue) => {
          target[property] = newValue;
          if (
            !invalidSymbols.has(property) &&
            hasOwnProperty.call(target, property)
          ) {
            const topologySet = target[meta];
            currentController &&
              topologySet.forEach((topology) =>
                topology.unsubscribe(currentController)
              );
            newValue = proxyResolver(target, property);
            topologySet.forEach((topology) =>
              topology.fetch(property).update(newValue, dispatchSource.self)
            );
          }
          return true;
        },
        deleteProperty: (target, property) => {
          const exist = Reflect.has(target, property);
          if (Reflect.deleteProperty(target, property)) {
            exist &&
              isString(property) &&
              target[meta].forEach((topology) =>
                topology.fetch(property).update(void 0, dispatchSource.self)
              );
            return true;
          }
          return false;
        },
      }
    ) =>
    (target, property) => {
      const isRootScope = property == null;
      let data = isRootScope ? target : target[property];
      if (data instanceof Object || (data && !data.constructor)) {
        const resolvedData = resolvedDataMap.get(data);
        if (resolvedData) {
          data = resolvedData;
        } else {
          data[meta] = new Set();
          if (validConstructorSet.has(data.constructor)) {
            const resolvedData = new Proxy(data, proxyHandler);
            originalWeakMapSet.call(resolvedDataMap, data, resolvedData);
            forEach(ownKeys(data), (key) => proxyResolver(data, key));
            data = resolvedData;
          }
          originalWeakMapSet.call(resolvedDataMap, data, data);
        }
      }
      isRootScope
        ? data[meta].add(new Topology(null, "", data))
        : (target[property] = data);
      return data;
    }
  )(),
  ModuleProfile = ((
    elementProfileCacheMap = new Map(),
    embeddedType = {
      json: "dagger/json",
      namespace: "dagger/configs",
      script: "dagger/script",
      style: "dagger/style",
      string: "dagger/string",
    },
    integrityProfileCache = emptier(),
    mimeType = {
      html: "text/html",
      json: "application/json",
      script: ["application/javascript", "javascript/esm", "text/javascript"],
      style: "text/css",
    },
    nameRegExp = /^[$a-zA-Z_]{1}[\w-$]*$/,
    pathRegExp = /^[$a-zA-Z_]{1}[\w-$]*(\.[$a-zA-Z_]{1}[\w-$]*)*$/,
    relativePathRegExp = /(?:^|;|\s+)(?:export|import)\s*?(?:(?:(?:[$\w*\s{},]*)\s*from\s*?)|)(?:(?:"([^"]+)?")|(?:'([^']+)?'))[\s]*?(?:$|)/gm,
    remoteUrlRegExp = /^(http:\/\/|https:\/\/|\/|\.\/|\.\.\/)/i,
    childModuleResolver = (parentModule, { config, module, name, type }) => {
      if (Object.is(type, resolvedType.script)) {
        !Reflect.has(config, "anonymous") || config.anonymous
          ? Object.assign(parentModule, module)
          : (parentModule[name] = module);
      } else if (
        (Object.is(type, resolvedType.namespace) && config.explicit) ||
        Object.is(type, resolvedType.json)
      ) {
        config.anonymous
          ? Object.assign(parentModule, module)
          : (parentModule[name] = module);
      } else if (Object.is(type, resolvedType.string)) {
        parentModule[name] = module;
      }
    },
    configNormalizer = (
      (
        resolvedTypes = hashTableResolver(
          ...Object.keys(resolvedType).map((type) => `@${type}`)
        ),
        normalizer = (config, type) => {
          (Array.isArray(config) || !(config instanceof Object)) &&
            (config = { uri: config, candidates: config });
          config.candidates &&
            (Array.isArray(config.candidates) ||
              (config.candidates = [config.candidates]));
          Object.assign(
            config,
            (config.candidates || []).find((item) => {
              try {
                return (
                  item instanceof Object &&
                  (!Reflect.has(item, "match") ||
                    matchMedia(item.match).matches ||
                    functionResolver(item.match))
                );
              } catch (error) {
                return false;
              }
            })
          );
          config.type || (config.type = type);
          config.uri &&
            (Array.isArray(config.uri) || (config.uri = [config.uri]));
          return config;
        }
      ) =>
      (config) =>
        forEach(Object.keys(config), (key) =>
          resolvedTypes[key] && config[key] instanceof Object
            ? forEach(Object.entries(config[key]), ([name, value]) => {
                asserter(
                  [`The module "${name}" already exists in "%o"`, config],
                  !Reflect.has(config, name)
                );
                config[name] = normalizer(value, key.substring(1));
              }) || Reflect.deleteProperty(config, key)
            : (config[key] = normalizer(config[key]))
        ) || config
    )(),
    dependencyResolver = (
      (
        resolver = (moduleProfile, dependencies, parent) =>
          parent &&
          ((moduleProfile.integrity &&
            (Object.is(moduleProfile.integrity, parent.integrity) ||
              resolver(moduleProfile, dependencies, parent.parent)) &&
            !dependencies.includes(moduleProfile.path)) ||
            (moduleProfile.dependencies &&
              (moduleProfile.dependencies.includes(parent) ||
                moduleProfile.dependencies.some((moduleProfile) =>
                  resolver(moduleProfile, dependencies, parent)
                )))) &&
          dependencies.push(moduleProfile.path)
      ) =>
      (moduleProfile, parent) => {
        if (!parent) {
          return;
        }
        parent.dependencies || (parent.dependencies = []);
        parent.dependencies.push(moduleProfile);
        const dependencies = [];
        resolver(moduleProfile, dependencies, parent);
        const path = parent.path;
        asserter(
          `Failed to resolve template module "${path}" with recursive or circular reference "${[
            path,
            ...dependencies.reverse(),
            path,
          ].join(" -> ")}"`,
          !dependencies.length
        );
      }
    )(),
    scopedRuleResolver = (
      (selectorRegExp = /([\s:+>~])/) =>
      (sheet, rule, name, iterator) => {
        if (rule instanceof CSSKeyframesRule) {
          const originalName = rule.name;
          rule.name = `${originalName}-${name}`;
          sheet.insertRule(rule.cssText, iterator.index++);
          rule.name = originalName;
        }
        if ((rule.cssRules||[]).length) {
          forEach(rule.cssRules, (rule) =>
            scopedRuleResolver(sheet, rule, name, iterator)
          );
        } else if (rule.selectorText) {
          const style = rule.style,
            originalAnimationName = style.animationName;
          originalAnimationName &&
            (style.animationName = `${originalAnimationName}-${name}`);
          sheet.insertRule(
            `${rule.selectorText
              .split(",")
              .map(
                (selector) =>
                  (selector = selector.trim()) &&
                  `${
                    selectorRegExp.test(selector)
                      ? selector.replace(selectorRegExp, `[${name}]$1`)
                      : `${selector}[${name}]`
                  }, [${name}] ${selector}`
              )
              .join(", ")}{${style.cssText}}`,
            iterator.index++
          );
          originalAnimationName &&
            (style.animationName = originalAnimationName);
        }
      }
    )(),
    scriptModuleResolver = (module, resolvedModule) => {
      try {
        forEach(ownKeys(module), (key) => {
          const value = module[key];
          const isFunction = value instanceof Function;
          resolvedModule[key] = isFunction ? processorWrapper(value) : value;
          value instanceof Object &&
            !isFunction &&
            scriptModuleResolver(value, value);
        });
      } catch (error) {
      } finally {
        return resolvedModule;
      }
    },
    styleResolver = (content, name, disabled) => {
      const style = document.createElement("style");
      content && (style.textContent = content);
      document.head.appendChild(style);
      style.disabled = disabled;
      style.setAttribute("name", name);
      style.setAttribute("router-debug", location.href);
      style.setAttribute("active-debug", !disabled);
      return style;
    },
    ModuleProfile = class {
      constructor(config = {}, base = "", name = "", parent = null) {
        asserter(
          `The module name should be valid string matched RegExp "${nameRegExp.toString()}" instead of "${name}"`,
          !parent || nameRegExp.test(name)
        );
        (this.name = name),
          (this.state = "unresolved"),
          (this.childrenCache = emptier()),
          (this.valid = true),
          (this.module =
            this.integrity =
            this.parent =
            this.children =
            this.type =
            this.content =
            this.resolvedContent =
              null);
        if (parent) {
          (this.parent = parent),
            (this.path = parent.path ? `${parent.path}.${name}` : name),
            (this.baseElement = parent.baseElement);
        } else {
          (this.path = name), (this.baseElement = document);
        }
        const { integrity, uri, type } = config;
        if (type) {
          asserter(
            `The type of module "${this.path}" should be one of "json, namespace, script, style, string, template" instead of "${type}"`,
            resolvedType[type]
          );
          this.type = type;
        }
        if (Reflect.has(config, "content")) {
          this.content = config.content;
          asserter(
            `The type of module "${this.path}" should be specified as one of "json, namespace, script, style, string, template" instead of "${type}"`,
            type
          );
        } else if (uri) {
          this.URIs = uri;
        } else {
          asserter([
            `Failed to parse the config "%o" for module "${this.path}" as there is no valid "content" or "uri" definition`,
            config,
          ]);
        }
        daggerOptions.integrity && integrity && (this.integrity = integrity);
        (this.config = config),
          (this.promise = new Promise(
            (resolver) => (this.resolver = resolver)
          )),
          (this.base = new URL(
            config.base || base,
            (parent || {}).base || document.baseURI
          ).href);
      }
      fetch(paths) {
        paths = paths.split(".");
        const path = paths.shift().trim(),
          moduleProfile =
            this.childrenCache[path] ||
            (this.childrenCache[path] = (this.children || []).find((child) =>
              Object.is(child.name, path)
            ));
        asserter(
          `Failed to fetch module "${path}" within namespace "${
            this.path || "[root]"
          }"`,
          !Object.is(moduleProfile)
        );
        return (
          moduleProfile &&
          moduleProfile
            .resolve()
            .then(
              (moduleProfile) =>
                moduleProfile.valid && moduleProfile.fetchSync(paths)
            )
        );
      }
      fetchSync(paths) {
        if (!paths.length) {
          return this;
        }
        const path = paths.shift().trim(),
          moduleProfile =
            this.childrenCache[path] ||
            (this.childrenCache[path] = (this.children || []).find(
              (child) => Object.is(child.name, path) && child.valid
            ));
        asserter(
          `Failed to fetch module "${path}" within namespace "${
            this.path || "[root]"
          }"`,
          !Object.is(moduleProfile)
        );
        dependencyResolver(moduleProfile, this);
        return moduleProfile && moduleProfile.fetchSync(paths);
      }
      resolve() {
        const type = this.type;
        if (!Object.is(this.state, "unresolved")) {
          if (this.valid && Object.is(this.state, "resolved")) {
            if (Object.is(type, resolvedType.style)) {
              this.resolveModule(this.resolvedContent);
            } else if (Object.is(type, resolvedType.namespace)) {
              forEach(this.children, (child) => child.resolve());
            }
          }
          return this.promise;
        }
        this.state = "resolving";
        logger(`The module "${this.path || "[root]"}" is "resolving..."`);
        let pipeline = null;
        if (this.content == null) {
          pipeline = [
            ...this.URIs.map((uri) => {
              asserter(
                [
                  `The "uri" of module "${this.path}" should be valid "string" instead of "%o"`,
                  uri,
                ],
                isString(uri)
              );
              return (data, token) =>
                (token.stop = !!data) || this.resolveURI(uri);
            }),
            (moduleProfile) => {
              if (!moduleProfile) {
                asserter(
                  [
                    `Failed to resolve uri of module "${this.path}" from "%o"`,
                    this.URIs,
                  ],
                  this.config.optional
                );
                (this.valid = false) || this.resolved(null);
              }
            },
          ];
        } else {
          const content = this.content;
          if ([resolvedType.namespace, resolvedType.json].includes(type)) {
            asserter(
              [
                `The content of module "${this.path}" with type "${type}" should be valid "object" instead of "%o"`,
                content,
              ],
              content && Object.is(typeof content, "object")
            );
            pipeline = [
              Object.is(type, resolvedType.namespace)
                ? this.resolveNamespace(content)
                : content,
            ];
          } else {
            pipeline = [this.resolveContent(content)];
          }
          pipeline = [
            ...pipeline,
            (resolvedContent) => this.resolveModule(resolvedContent),
            (module) => this.resolved(module),
          ];
        }
        serializer(pipeline);
        return this.promise;
      }
      resolveContent(content) {
        isString(content) || (content = originalStringifyMethod(content));
        this.content = content.trim();
        const type = this.type;
        if (Object.is(type, resolvedType.namespace)) {
          this.baseElement = templateResolver(content);
          return serializer([
            configResolver(this.baseElement, this.base),
            ({ base, content }) => this.resolveNamespace(content, base),
          ]);
        } else if (Object.is(type, resolvedType.script)) {
          return import(
            `data:text/javascript, ${encodeURIComponent(
              content.replace(relativePathRegExp, (match, url1, url2) =>
                match.replace(url1 || url2, new URL(url1 || url2, this.base))
              )
            )}`
          ).catch(() =>
            asserter(
              `Failed to import dynamic script module "${this.path}" with resolved content "${content}"`
            )
          );
        } else if (Object.is(type, resolvedType.template)) {
          const fragment = templateResolver(content),
            pipeline = [],
            styles = this.config.style;
          styles &&
            pipeline.push(
              Promise.all(
                (Array.isArray(styles) ? styles : [styles]).map((path) =>
                  this.parent.fetch(path).then((style) => {
                    asserter(
                      `Failed to fetch style module "${path}" within namespace "${this.parent.path}"`,
                      style && Object.is(style.type, resolvedType.style)
                    );
                    return style.module && style.module.getAttribute("name");
                  })
                )
              ).then((names) =>
                selectorInjector(
                  fragment,
                  names.filter((name) => name)
                )
              )
            );
          pipeline.push(() => {
            const parentPath = this.parent.path,
              nodeProfile = new NodeProfile(
                fragment,
                parentPath ? parentPath.split(".") : [],
                null,
                null,
                false,
                {}
              );
            return Promise.all(nodeProfile.promises || []).then(
              () => nodeProfile
            );
          });
          return serializer(pipeline);
        } else if (Object.is(type, resolvedType.style)) {
          return styleResolver(
            content,
            `dg_style_module_content-${this.path.replace(/\./g, "_")}`,
            true
          );
        } else if (Object.is(type, resolvedType.json)) {
          return JSON.parse(content);
        } else if (Object.is(type, resolvedType.string)) {
          return this.content;
        } else {
          asserter(
            `Failed to resolve module "${this.path}" of unknown type "${type}"`
          );
        }
      }
      resolved(module) {
        this.module = module;
        this.state = "resolved";
        this.resolver(this);
        logger(
          `The "${this.type}" module "${this.path || "[root]"}" is "resolved".`
        );
        return this;
      }
      resolveEmbeddedType(element) {
        if (this.type) {
          return;
        }
        const { tagName, type } = element,
          isScript = Object.is(tagName, "SCRIPT");
        if (Object.is(tagName, "TEMPLATE")) {
          this.type = resolvedType.template;
        } else if (isScript && Object.is(type, embeddedType.namespace)) {
          this.type = resolvedType.namespace;
          return this.resolveNamespace(
            functionResolver(`(${element.innerHTML})`),
            element.getAttribute("base") || this.base
          );
        } else if (isScript && Object.is(type, embeddedType.script)) {
          this.type = resolvedType.script;
        } else if (isScript && Object.is(type, embeddedType.json)) {
          this.type = resolvedType.json;
        } else if (
          Object.is(tagName, "STYLE") &&
          Object.is(type, embeddedType.style)
        ) {
          this.type = resolvedType.style;
        } else {
          this.type = resolvedType.string;
        }
      }
      resolveModule(resolvedContent) {
        this.resolvedContent = resolvedContent;
        let module = resolvedContent;
        const type = this.type;
        if (Object.is(type, resolvedType.namespace)) {
          module = emptier();
          this.children = this.resolvedContent;
          forEach(resolvedContent, (moduleProfile) =>
            childModuleResolver(module, moduleProfile)
          );
          this.parent &&
            this.parent
              .resolve()
              .then((moduleProfile) =>
                Object.setPrototypeOf(module, moduleProfile.module)
              );
        } else if (Object.is(type, resolvedType.script)) {
          module = scriptModuleResolver(module, emptier());
        } else if (Object.is(type, resolvedType.style)) {
          if (!Reflect.has(this.config, "scoped") || this.config.scoped) {
            asserter(
              `It's invalid to use "$" in style module path "${this.path}"`,
              !this.path.includes("$")
            );
            const name = `dg_style_module-${this.path.replace(/\./g, "_")}`,
              style = styleResolver("", name, true),
              sheet = style.sheet,
              iterator = { index: 0 };
            forEach(module.sheet.cssRules, (rule) =>
              scopedRuleResolver(sheet, rule, name, iterator)
            );
            module = style;
          }
          originalSetAdd.call(styleModuleSet, module);
        } else if (Object.is(type, resolvedType.template)) {
          asserter(
            `It's invalid to use "$" or "-" in template module path "${this.path}"`,
            !this.path.includes("$") && !this.path.includes("-")
          );
        }
        return module;
      }
      resolveNamespace(config, base = this.base) {
        this.parent && configNormalizer(config);
        this.children = Object.entries(config).map(([key, value]) =>
          this.parent
            ? new ModuleProfile(value, base, key, this)
            : (value.parent = this) && value
        );
        return Promise.all(
          this.children
            .map((child) => dependencyResolver(child, this) || child.resolve())
            .filter((_, index) => {
              const child = this.children[index];
              const prefetch = child.config.prefetch;
              return (
                !prefetch ||
                new RegExp(prefetch).test(
                  Object.is(daggerOptions.routing.mode, "history")
                    ? location.pathname
                    : location.hash
                )
              );
            })
        );
      }
      resolveRemoteType(content, type, url) {
        this.base = url;
        if (this.type) {
          return;
        }
        if (
          url.endsWith(".js") ||
          url.endsWith(".mjs") ||
          mimeType.script.some((scriptType) => type.includes(scriptType))
        ) {
          this.type = resolvedType.script;
        } else if (url.endsWith(".css") || type.includes(mimeType.style)) {
          this.type = resolvedType.style;
        } else if (url.endsWith(".html") || type.includes(mimeType.html)) {
          content = content.trim();
          this.type =
            content.startsWith("<html>") || content.startsWith("<!DOCTYPE ")
              ? resolvedType.namespace
              : resolvedType.template;
        } else if (url.endsWith(".json") || type.includes(mimeType.json)) {
          this.type = resolvedType.json;
        } else {
          this.type = resolvedType.string;
        }
      }
      resolveURI(uri) {
        uri = uri.trim();
        if (!uri) {
          return;
        }
        if (pathRegExp.test(uri)) {
          return this.parent
            .fetch(uri)
            .then(
              (moduleProfile) => (
                (this.resolvedContent = moduleProfile.resolvedContent),
                (this.type || (this.type = moduleProfile.type)) &&
                  (!Object.is(this.type, resolvedType.namespace) ||
                    this.resolveModule(moduleProfile.resolvedContent)) &&
                  this.resolved(moduleProfile.module)
              )
            );
        }
        let pipeline = null;
        if (remoteUrlRegExp.test(uri)) {
          const cachedProfile = integrityProfileCache[this.integrity];
          if (cachedProfile) {
            pipeline = [
              cachedProfile.resolve(),
              () =>
                (this.type = cachedProfile.type) &&
                cachedProfile.resolvedContent,
            ];
          } else {
            daggerOptions.integrity &&
              this.integrity &&
              (integrityProfileCache[this.integrity] = this);
            const base = new URL(uri, this.base).href;
            pipeline = [
              (data, token) =>
                serializer([
                  remoteResourceResolver(base, this.integrity),
                  (result) => result || (token.stop = true),
                ]),
              ({ content, type }) =>
                this.resolveRemoteType(content, type, base) ||
                this.resolveContent(content),
            ];
          }
        } else {
          const element = querySelector(this.baseElement, uri);
          const cachedProfile = elementProfileCacheMap.get(element);
          if (cachedProfile) {
            warner([
              `The module "${this.path}" and "${cachedProfile.path}" refer to the same embedded element "%o"`,
              element,
            ]);
            pipeline = [
              cachedProfile.resolve(),
              (moduleProfile) =>
                (this.type = moduleProfile.type) &&
                moduleProfile.resolvedContent,
            ];
          } else {
            originalMapSet.call(elementProfileCacheMap, element, this);
            pipeline = [
              this.resolveEmbeddedType(element) ||
                this.resolveContent(element.innerHTML),
            ];
          }
        }
        return (
          pipeline &&
          serializer([
            ...pipeline,
            (resolvedContent) => this.resolveModule(resolvedContent),
            (module) => this.resolved(module),
          ])
        );
      }
    }
  ) => {
    styleResolver(
      "[dg-cloak] { display: none !important; }",
      "dg-global-style",
      false
    );
    ModuleProfile.normalizeConfig = configNormalizer;
    return ModuleProfile;
  })(),
  NodeContext = ((
    dataUpdater = {
      checked: (node) =>
        Object.is(node.tagName, "OPTION") ? node.selected : node.checked,
      file: (node) => (node.multiple ? [...node.files] : node.files[0]) || null,
      focus: (node) => node.isSameNode(document.activeElement),
      result: (
        (
          processor = (file, { buffer, data, encoding }) => {
            let result = {
              file,
              loaded: 0,
              progress: 0,
              state: "initialized",
              content: null,
            };
            const fileReader = new FileReader();
            fileReader.onloadstart = () => (
              (result =
                (result && result[meta] && [...result[meta]][0].value) ||
                result),
              (result.state = "loading")
            );
            fileReader.onprogress = ({ loaded }) => (
              (result.loaded = loaded),
              (result.progress = Math.floor((loaded / file.size) * 100))
            );
            fileReader.onload = () => (
              (result.state = "loaded"), (result.content = fileReader.result)
            );
            fileReader.onerror = () => (result.state = "error");
            fileReader.onabort = () => (result.state = "abort");
            if (buffer) {
              fileReader.readAsArrayBuffer(file);
            } else if (data) {
              fileReader.readAsDataURL(file);
            } else {
              fileReader.readAsText(file, encoding || "utf-8");
            }
            return result;
          }
        ) =>
        (node, decorators) =>
          node.multiple
            ? [...node.files].map((file) => processor(file, decorators))
            : processor(node.files[0], decorators)
      )(),
      selected: (node) => {
        const { name, type, tagName } = node,
          isSelect = Object.is(tagName, "SELECT");
        asserter(
          [
            `Please specify valid "name" attribute on input node "%o" to support "$selected" directive`,
            node,
          ],
          isSelect || name
        );
        const data = [
            ...(isSelect
              ? node.selectedOptions
              : querySelector(
                  document.body,
                  `input[type="${type}"][name="${name}"]:checked`,
                  true
                )),
          ].map((node) => valueResolver(node)),
          multiple = isSelect ? node.multiple : Object.is(type, "checkbox");

        return multiple ? data : data[0];
      },
      value: ({ type, value, valueAsNumber }, { number, trim }, { detail }) => {
        if (detail) {
          return null;
        }
        if (["date", "datetime-local"].includes(type)) {
          return new Date(valueAsNumber || 0);
        }
        if (["number", "range"].includes(type)) {
          return valueAsNumber;
        }
        if (number) {
          return Number.parseFloat(value);
        }
        if (trim) {
          return value.trim();
        }
        return value;
      },
    },
    nameFilters = ["draggable"],
    generalUpdater = (data, node, _, { name }) =>
      node &&
      (data == null
        ? node.removeAttribute(name)
        : node.setAttribute(name, textResolver(data))),
    nodeUpdater = ((changeEvent = new Event("change")) => ({
      $boolean: (data, node, _, { name }) => node.toggleAttribute(name, !!data),
      checked: (data, node, { parentNode }, { decorators }) => {
        const { tagName, type } = node,
          isOption = Object.is(tagName, "OPTION"),
          isCheckbox = Object.is(type, "checkbox");
        if (
          isOption ||
          (Object.is(tagName, "INPUT") &&
            (isCheckbox || Object.is(type, "radio")))
        ) {
          let nodes = null;
          if (isOption) {
            if (Object.is(data, node.selected)) {
              return;
            }
            node.selected = data;
            const select = parentNode;
            if (select) {
              !select.multiple &&
                data &&
                (nodes = querySelector(select, "option", true));
              if (!select.$changeEvent) {
                select.$changeEvent = true;
                select.addEventListener("change", (event) =>
                  forEach(
                    querySelector(event.target, "option", true),
                    (option) => option.dispatchEvent(changeEvent)
                  )
                );
              }
            }
          } else {
            isCheckbox &&
              decorators.indeterminate &&
              (node.indeterminate = data == null);
            node.indeterminate || (node.checked = data);
            isCheckbox ||
              (data &&
                (nodes = querySelector(
                  document.body,
                  `input[type="radio"][name="${node.name}"]`,
                  true
                )));
          }
          nodes &&
            promisor.then(() =>
              forEach(nodes, (node) => node.dispatchEvent(changeEvent))
            );
        } else {
          generalUpdater(data, node, null, { name: "checked" });
        }
      },
      class: (data, node, { profile: { classNames } }) => {
        if (data) {
          const classNameSet = new Set(classNames);
          if (Array.isArray(data)) {
            forEach(data, (className) =>
              originalSetAdd.call(classNameSet, textResolver(className))
            );
          } else if (data instanceof Object) {
            forEach(
              Object.keys(data),
              (key) =>
                data[key] && originalSetAdd.call(classNameSet, key.trim())
            );
          } else {
            originalSetAdd.call(classNameSet, textResolver(data));
          }
          node.setAttribute("class", [...classNameSet].join(" ").trim());
        } else {
          classNames
            ? node.setAttribute("class", classNames.join(" "))
            : node.removeAttribute("class");
        }
      },
      each: (
        (
          sliceResolver = (
            index,
            key,
            value,
            children,
            childrenMap,
            newChildrenMap,
            indexName,
            keyName,
            itemName,
            plainSliceScope,
            nodeContext,
            profile,
            parentNode
          ) => {
            let matchedNodeContext = null;
            const matchedArray = childrenMap.get(value);
            if (matchedArray) {
              matchedNodeContext = matchedArray.shift();
              matchedArray.length || originalMapDelete.call(childrenMap, value);
              if (!Object.is(index, matchedNodeContext.index)) {
                const { landmark, upperBoundary } = matchedNodeContext,
                  array = [upperBoundary];
                let node = upperBoundary;
                while (!Object.is(node, landmark)) {
                  node = node.nextSibling;
                  array.push(node);
                }
                forEach(array.reverse(), (node) =>
                  parentNode.insertBefore(
                    node,
                    (index
                      ? children[index - 1].landmark || {}
                      : nodeContext.upperBoundary
                    ).nextSibling
                  )
                );
                children.includes(matchedNodeContext) &&
                  children.splice(matchedNodeContext.index, 1);
                matchedNodeContext.index = index;
                children[index] = matchedNodeContext;
              }
              matchedNodeContext.scope[keyName] = key;
              matchedNodeContext.scope[indexName] = index;
            } else {
              matchedNodeContext = new NodeContext(
                profile,
                nodeContext,
                index,
                { [indexName]: index, [keyName]: key, [itemName]: value },
                plainSliceScope
              );
            }
            const newMatchedArray = newChildrenMap.get(value);
            newMatchedArray
              ? newMatchedArray.push(matchedNodeContext)
              : originalMapSet.call(newChildrenMap, value, [
                  matchedNodeContext,
                ]);
          },
          originalMapDelete = Map.prototype.delete
        ) =>
        (data, _, nodeContext, { decorators }) => {
          data = data || {};
          const valueSet = new Set(
              data.values instanceof Function
                ? data.values()
                : Object.values(data)
            ),
            entries = [
              ...(data.entries instanceof Function
                ? data.entries()
                : Object.entries(data)),
            ],
            { children, childrenMap, profile, parentNode } = nodeContext,
            topologySet = data[meta];
          topologySet &&
            forEach(
              entries,
              ([key, value]) =>
                value &&
                value[meta] &&
                topologySet.forEach((topology) => topology.fetch(key, value))
            );
          if (!entries.length) {
            return (
              originalMapClear.call(childrenMap) ||
              nodeContext.removeChildren(true)
            );
          }
          childrenMap.forEach(
            (array, value) =>
              valueSet.has(value) ||
              forEach(array, (nodeContext) => nodeContext.destructor(true)) ||
              originalMapDelete.call(childrenMap, value)
          );
          const newChildrenMap = new Map();
          let {
            item: itemName = "item",
            key: keyName = "key",
            index: indexName = "index",
            plain,
          } = decorators;
          Object.is(itemName, true) && (itemName = "item");
          Object.is(keyName, true) && (keyName = "key");
          Object.is(indexName, true) && (indexName = "index");
          warner(
            [
              'duplication found in slice scope schemes "%o"',
              { item: itemName, key: keyName, index: indexName },
            ],
            !Object.is(keyName, indexName) &&
              !Object.is(keyName, itemName) &&
              !Object.is(itemName, indexName)
          );
          forEach(entries, ([key, value], index) =>
            sliceResolver(
              index,
              key,
              value,
              children,
              childrenMap,
              newChildrenMap,
              indexName,
              keyName,
              itemName,
              plain,
              nodeContext,
              profile,
              parentNode
            )
          );
          children.length = entries.length;
          childrenMap.forEach((array) =>
            forEach(
              array,
              (nodeContext) => (
                (nodeContext.parent = null), nodeContext.destructor(true)
              )
            )
          );
          nodeContext.childrenMap = newChildrenMap;
        }
      )(),
      exist: (data, _, nodeContext) =>
        data
          ? Object.is(nodeContext.state, "unloaded") && nodeContext.loading()
          : nodeContext.unloading(true),
      file: (data, node) =>
        asserter(
          [
            `The data bound to directive "$file" of element "%o" should be "File${
              node.multiple ? " array" : ""
            }" instead of "%o"`,
            node,
            data,
          ],
          !data ||
            (node.multiple
              ? Array.isArray(data) &&
                Array.every((file) => file instanceof File)
              : data instanceof File)
        ),
      focus: (data, node, _, { decorators: { prevent = false } }) =>
        data ? node.focus({ preventScroll: prevent }) : node.blur(),
      html: (data, node, nodeContext, { decorators: { root = false } }) => {
        data = textResolver(data);
        nodeContext.removeChildren(true);
        if (!data) {
          return;
        }
        const rootNodeProfiles = [],
          profile = nodeContext.profile,
          fragment = templateResolver(data);
        if (!node) {
          const styles = profile.node.getAttribute("dg_scoped_styles");
          styles && selectorInjector(fragment, styles.split(","));
        }
        Reflect.construct(NodeProfile, [
          fragment,
          root ? [] : profile.paths,
          rootNodeProfiles,
          null,
          true,
        ]);
        if (rootNodeProfiles.length) {
          processorResolver();
          Promise.all(
            rootNodeProfiles.map((nodeProfile) =>
              Promise.all(nodeProfile.promises || [])
            )
          ).then(() =>
            forEach(
              rootNodeProfiles,
              (nodeProfile, index) =>
                nodeContext.profile &&
                Reflect.construct(NodeContext, [
                  nodeProfile,
                  root ? null : nodeContext,
                  index,
                  null,
                  false,
                  (nodeProfile.landmark || nodeProfile.node).parentNode,
                ])
            )
          );
        }
        node
          ? node.appendChild(fragment)
          : nodeContext.parentNode.insertBefore(fragment, nodeContext.landmark);
      },
      result: (data, node) =>
        asserter(
          [
            `The data bound to directive "$result" of element "%o" should be "object${
              node.multiple ? " array" : ""
            }" instead of "%o"`,
            node,
            data,
          ],
          !data ||
            (node.multiple
              ? Array.isArray(data) &&
                Array.every((file) => file instanceof Object)
              : data instanceof Object)
        ),
      selected: (
        (
          selectedResolver = (node, data, multiple) => {
            const value = valueResolver(node);
            return multiple
              ? (data || []).some((item) => Object.is(item, value))
              : Object.is(data, value);
          }
        ) =>
        (data, node) => {
          const { type, tagName } = node,
            isSelect = Object.is(tagName, "SELECT");
          if (
            isSelect ||
            (Object.is(tagName, "INPUT") &&
              (Object.is(type, "checkbox") || Object.is(type, "radio")))
          ) {
            const multiple = isSelect
              ? node.multiple
              : Object.is(type, "checkbox");
            multiple &&
              asserter(
                [
                  `The data bound to directive "$selected" of element "%o" should be "array" instead of "%o"`,
                  node,
                  data,
                ],
                data == null || Array.isArray(data)
              );
            if (isSelect) {
              promisor.then(() =>
                forEach(
                  querySelector(node, "option", true),
                  (option) =>
                    (option.selected = selectedResolver(option, data, multiple))
                )
              );
            } else {
              node.checked = selectedResolver(node, data, multiple);
            }
          } else {
            generalUpdater(data, node, null, { name: "selected" });
          }
        }
      )(),
      style: (
        (
          styleUpdater = (resolvedStyles, content) => {
            if (!content) {
              return;
            }
            const [key, value = ""] = content
              .split(":")
              .map((item) => item.trim());
            asserter(
              `The content "${content}" is not a valid style declaration`,
              key && value
            );
            resolvedStyles[key] = value;
          }
        ) =>
        (data, node, { profile: { inlineStyle, styles } }) => {
          if (data) {
            const resolvedStyles = Object.assign({}, styles);
            if (Array.isArray(data)) {
              forEach(data, (item) =>
                styleUpdater(resolvedStyles, textResolver(item))
              );
            } else if (data instanceof Object) {
              forEach(
                Object.keys(data),
                (key) => (resolvedStyles[key.trim()] = textResolver(data[key]))
              );
            } else {
              forEach(textResolver(data).split(";"), (item) =>
                styleUpdater(resolvedStyles, item.trim())
              );
            }
            node.style.cssText = Object.keys(resolvedStyles)
              .filter((key) => resolvedStyles[key])
              .map((key) => `${key}: ${resolvedStyles[key]}; `)
              .join("")
              .trim();
          } else {
            inlineStyle
              ? node.setAttribute("style", inlineStyle)
              : node.removeAttribute("style");
          }
        }
      )(),
      text: (data, node) => {
        data = textResolver(data);
        Object.is(data, node.textContent) || (node.textContent = data);
      },
      value: (
        (
          timeNormalizer = (data, padLength = 2) =>
            String(data).padStart(padLength, "0")
        ) =>
        (data, node, nodeContext, { decorators: { trim = false } }) => {
          nodeContext.value = data;
          const { tagName, type } = node,
            isInput = Object.is(tagName, "INPUT");
          asserter(
            [`It's illegal to use directive "$value" on element "%o"`, node],
            !(isInput && Object.is(type, "file"))
          );
          if (isInput) {
            const isDate = ["date", "datetime-local"].includes(type);
            if (data instanceof Date) {
              if (isDate || Object.is(type, "week")) {
                node.valueAsNumber = data;
              } else if (Object.is(type, "month")) {
                node.value = `${data.getUTCFullYear()}-${timeNormalizer(
                  data.getUTCMonth() + 1
                )}`;
              } else if (Object.is(type, "time")) {
                const step = node.step || 0;
                let value = `${timeNormalizer(
                  data.getUTCHours()
                )}:${timeNormalizer(data.getUTCMinutes())}`;
                if (step % 60) {
                  value = `${value}:${timeNormalizer(data.getUTCSeconds())}`;
                  step % 1 &&
                    (value = `${value}.${timeNormalizer(
                      data.getUTCMilliseconds(),
                      3
                    )}`);
                }
                node.value = value;
              } else {
                node.value = data;
              }
            } else {
              data = textResolver(data, trim);
              isDate
                ? (node.valueAsNumber = new Date(data))
                : (node.value = data);
            }
          } else {
            node.value = textResolver(data, trim);
          }
        }
      )(),
    }))(),
    modifierResolver = (
      (
        resolver = (event, modifier) => {
          modifier = String(modifier);
          const positive = !modifier.startsWith("!");
          positive || (modifier = modifier.substring(1));
          const modifierRegExp = new RegExp(modifier),
            result =
              (event.getModifierState && event.getModifierState(modifier)) ||
              [event.code, event.key, event.button].some((value) =>
                modifierRegExp.test(value)
              );
          return positive == result;
        }
      ) =>
      (event, modifiers, methodName) =>
        !modifiers ||
        (Array.isArray(modifiers) || (modifiers = [modifiers]),
        modifiers[methodName]((modifier) => resolver(event, modifier)))
    )(),
    directivesRemover = (targetNames, directives, callback) =>
      directives &&
      forEach(
        directives
          .filter(
            (directive, index) =>
              directive &&
              ((directive.index = index),
              directive.decorators &&
                targetNames.includes(directive.decorators.name))
          )
          .reverse(),
        (directive) =>
          callback(directive) || directives.splice(directive.index, 1)
      ),
    valueResolver = (node) =>
      node && Reflect.has(node[context] || {}, "value")
        ? node[context].value
        : node.value,
    NodeContext = class {
      constructor(
        profile,
        parent = null,
        index = 0,
        sliceScope = null,
        plainSliceScope = false,
        parentNode = null
      ) {
        (this.directives = profile.directives),
          (this.profile = profile),
          (this.index = index),
          (this.state = "loaded"),
          (this.promise =
            this.resolver =
            this.parent =
            this.children =
            this.childrenMap =
            this.existController =
            this.landmark =
            this.upperBoundary =
            this.childrenController =
            this.controller =
            this.controllers =
            this.eventHandlers =
            this.scope =
            this.sentry =
            this.node =
              null);
        if (parent) {
          this.parent = parent;
          this.parentNode = parentNode || parent.node || parent.parentNode;
          const paths = profile.paths;
          this.module = Object.is(paths, parent.profile.paths)
            ? parent.module
            : rootNamespace.fetchSync([...paths]).module;
          this.scope = parent.scope;
          parent.children.splice(index, 0, this);
        } else {
          this.parentNode =
            profile.node.parentNode || profile.landmark.parentNode;
          this.module = rootNamespace.module;
          this.scope = (htmlNodeContext || {}).scope || rootScope;
        }
        const dynamic = profile.dynamic;
        if (dynamic) {
          const expressions = dynamic.processor(
              this.module,
              this.scope,
              this.parentNode
            ),
            directives = this.directives;
          this.directives = Object.assign({}, directives, {
            controllers: [...(directives.controllers || [])],
            eventHandlers: [...(directives.eventHandlers || [])],
          });
          forEach(
            Array.isArray(expressions) ? expressions : [expressions],
            (expression) => {
              if (isString(expression)) {
                // assert invalid expression
                const index = expression.indexOf("="),
                  withoutEqual = index < 0;
                expression = {
                  name: withoutEqual
                    ? expression
                    : expression.substring(0, index),
                  value: withoutEqual ? "" : expression.substring(index + 1),
                };
              }
              profile.resolveDirective(
                expression.name,
                expression.value || "",
                this.directives
              );
            }
          );
          processorResolver();
        }
        const { plain, text, html, raw } = profile;
        if (html) {
          htmlNodeContext = this;
          return this.loading();
        }
        if (raw || plain) {
          // comment/raw/script/style/template
          this.resolveNode();
          this.node.removeAttribute && this.node.removeAttribute("dg-cloak");
          plain && this.resolveChildren();
        } else if (text) {
          this.resolveNode(
            () => (this.controller = this.resolveController(text))
          );
        } else {
          const { each, exist } = this.directives || {};
          (each || exist || profile.virtual) &&
            this.resolveLandmark(sliceScope);
          if (sliceScope) {
            this.sliceScope = this.resolveScope(
              sliceScope,
              plainSliceScope,
              each.decorators.root
            );
            parent.children.length > index + 1 &&
              forEach(
                parent.children,
                (sibling, siblingIndex) =>
                  sibling && siblingIndex > index && sibling.index++
              );
          } else {
            profile.slotScope &&
              (this.slotScope = this.resolveScope(
                Object.assign({}, profile.slotScope),
                true
              ));
            if (each) {
              (this.children = []),
                (this.childrenMap = new Map()),
                (this.controller = this.resolveController(each));
              return this;
            }
          }
          if (exist) {
            this.state = "unloaded";
            this.existController = this.resolveController(exist);
          } else {
            this.loading();
          }
        }
      }
      destructor(isRoot) {
        this.unloading(isRoot);
        const { plain, text } = this.profile;
        if (!plain && !text) {
          if (isRoot) {
            this.landmark && this.landmark.remove();
            this.upperBoundary && this.upperBoundary.remove();
          }
          this.existController && this.removeController(this.existController);
          const siblings = (this.parent || {}).children;
          if (isRoot && siblings) {
            forEach(
              siblings,
              (sibling, siblingIndex) =>
                siblingIndex > this.index && sibling.index--
            );
            siblings.splice(this.index, 1);
          }
        }
        forEach(Reflect.ownKeys(this), (key) => {
          this[key] = null;
        });
      }
      initialize(scope, root) {
        if (scope) {
          const constructor = scope.constructor;
          (Object.is(constructor, Object) ||
            (!constructor && Object.is(typeof scope, "object"))) &&
            this.resolveScope(scope, false, root);
        }
        const { html, virtual } = this.profile;
        html ? (this.node = html) : virtual || this.resolveNode();
        this.loaded();
        html || this.resolveChildren();
      }
      loading() {
        this.state = "loading";
        const loading = (this.directives || {}).loading;
        loading
          ? this.resolvePromise(
              loading.processor(this.module, this.scope, null),
              (scope) =>
                Object.is(this.state, "loading") &&
                this.initialize(scope, loading.decorators.root)
            )
          : this.initialize();
      }
      loaded() {
        const loaded = (this.directives || {}).loaded;
        this.resolvePromise(
          loaded && loaded.processor(this.module, this.scope, this.node),
          () => Object.is(this.state, "loading") && this.postLoaded()
        );
      }
      postLoaded() {
        if (this.resolver) {
          this.resolver();
          this.resolver = null;
        }
        this.state = "loaded";
        this.node && this.node.removeAttribute("dg-cloak");
        if (this.directives) {
          const { controllers, eventHandlers, sentry } = this.directives;
          if (sentry) {
            this.sentry = Object.assign({}, sentry, {
              owner: this,
              processor: sentry.processor.bind(null, this.module, this.scope),
            });
            originalSetAdd.call(sentrySet, this.sentry);
          }
          eventHandlers &&
            (this.eventHandlers = eventHandlers.map(
              ({ event, decorators = {}, processor, name, options }) => {
                const target = decorators.target || this.node,
                  handler = (event) =>
                    this.updateEventHandler(
                      event,
                      name,
                      processor.bind(null, this.module, this.scope),
                      decorators
                    );
                asserter(
                  [
                    `The target of "+${event}" directive defined on element "%o" is invalid`,
                    this.node || this.profile.node,
                  ],
                  target
                );
                target.addEventListener(event, handler, options);
                return { target, event, handler, options, decorators };
              }
            ));
          controllers &&
            (this.controllers = controllers
              .map((controller) => this.resolveController(controller))
              .filter((controller) => controller));
        }
      }
      removeChildren(isRoot) {
        if (isRoot) {
          if (this.node) {
            this.node.innerHTML = "";
          } else if (this.upperBoundary) {
            let node = this.upperBoundary.nextSibling;
            while (node && !Object.is(node, this.landmark)) {
              const nextSibling = node.nextSibling;
              node.remove();
              node = nextSibling;
            }
          }
        }
        if ((this.children || []).length) {
          forEach(this.children, (child) => child && child.destructor(false));
          this.children.length = 0;
        }
      }
      removeController(controller) {
        controller.topologySet.forEach((topology) =>
          topology.unsubscribe(controller)
        );
        originalSetClear.call(controller.topologySet);
        controller.observer && controller.observer.disconnect();
        Object.is(controller, this.childrenController) &&
          (this.childrenController = null);
        Object.is(controller, this.existController) &&
          (this.existController = null);
      }
      removeDirectives(data, targetNames) {
        // TODO: assert
        if (!data) {
          return;
        }
        Array.isArray(targetNames) || (targetNames = [targetNames]);
        directivesRemover(
          targetNames,
          [...this.controllers, this.childrenController, this.existController],
          (controller) => this.removeController(controller)
        );
        directivesRemover(
          targetNames,
          this.eventHandlers,
          ({ target, event, handler, options }) =>
            target.removeEventListener(event, handler, options)
        );
      }
      resolveChildren() {
        const children = this.profile.children,
          child = (this.directives || {}).child;
        !this.children &&
          (children || (child && Object.is(child.name, "html"))) &&
          (this.children = []);
        child
          ? (this.childrenController = this.resolveController(child))
          : forEach(
              children,
              (child, index) => new NodeContext(child, this, index)
            );
      }
      resolveController({ name, decorators = emptyObject, processor }) {
        const node = this.node,
          subscribable = !decorators.once || decorators.lazy,
          controller = {
            name,
            owner: this,
            decorators,
            processor: processor.bind(null, this.module, this.scope),
            topologySet: subscribable ? new Set() : null,
            observer: null,
            updater:
              name &&
              (nodeUpdater[name] ||
                (node &&
                  !nameFilters.includes(name) &&
                  Object.is(typeof node[name], "boolean") &&
                  nodeUpdater.$boolean) ||
                generalUpdater),
          };
        subscribable &&
          node &&
          Object.is(name, "selected") &&
          Object.is(node.tagName, "SELECT") &&
          (controller.observer = new MutationObserver(() =>
            this.updateController(controller, true)
          )).observe(node, { childList: true });
        this.updateController(controller, true);
        return subscribable && controller;
      }
      resolveLandmark(sliceScope) {
        const {
          index,
          parent,
          parentNode,
          profile: { landmark, virtual },
        } = this;
        if (parent) {
          let baseLandmark = null;
          const nextSibling = parent.children[index + 1];
          if (nextSibling) {
            baseLandmark =
              nextSibling.upperBoundary ||
              nextSibling.node ||
              nextSibling.landmark;
          } else if (sliceScope) {
            baseLandmark = parent.landmark;
          } else if (parentNode.contains(landmark || null)) {
            baseLandmark = landmark;
          } else {
            baseLandmark = parent.node ? null : parent.landmark;
          }
          this.landmark = parentNode.insertBefore(
            textNode.cloneNode(false),
            baseLandmark
          );
        } else {
          this.landmark = landmark;
        }
        (virtual || (this.directives || {}).each) &&
          (this.upperBoundary = parentNode.insertBefore(
            textNode.cloneNode(false),
            this.landmark
          ));
      }
      resolveNode(callback) {
        const { node: baseNode, unique, raw } = this.profile,
          node = unique ? baseNode : baseNode.cloneNode(raw);
        this.node = node;
        node[context] = this;
        callback && callback();
        if (!node.isConnected) {
          const landmark =
            this.landmark ||
            (this.parent && (this.parent.node ? null : this.parent.landmark));
          this.parentNode.insertBefore(
            node,
            landmark && Object.is(this.parentNode, landmark.parentNode)
              ? landmark
              : null
          );
        }
      }
      resolvePromise(promise, callback) {
        if (promise instanceof Promise) {
          callback && (promise = promise.then(callback));
          this.resolver ||
            (this.promise = new Promise(
              (resolver) => (this.resolver = resolver)
            ));
        } else {
          callback && callback(promise);
        }
      }
      resolveScope(scope, plain, root) {
        // TODO: assert existed prototype: Object.getPrototypeOf(scope)[meta]
        plain || (scope = proxyResolver(scope));
        this.scope = Object.setPrototypeOf(
          scope,
          root ? rootScope : this.scope
        );
        return scope;
      }
      unloading(isRoot) {
        if (Object.is(this.state, "unloaded")) {
          return;
        }
        this.controller &&
          (this.removeController(this.controller) || (this.controller = null));
        if (this.profile.text) {
          this.state = "unloaded";
        } else {
          this.state = "unloading";
          if (this.profile.plain || this.childrenMap) {
            return this.removeChildren(isRoot);
          }
          this.childrenController &&
            this.removeController(this.childrenController);
          forEach(this.controllers, (controller) =>
            this.removeController(controller)
          ) || (this.controllers = null);
          forEach(this.eventHandlers, ({ target, event, handler, options }) =>
            target.removeEventListener(event, handler, options)
          ) || (this.eventHandlers = null);
          if (this.sentry) {
            originalSetDelete.call(sentrySet, this.sentry);
            this.sentry = null;
          }
          const unloading = (this.directives || {}).unloading;
          unloading && unloading.processor(this.module, this.scope, this.node);
          const node = this.node;
          isRoot && node && node.remove();
          this.node = null;
          this.removeChildren(isRoot);
          this.scope =
            this.sliceScope || (this.parent || htmlNodeContext).scope;
          const unloaded = (this.directives || {}).unloaded;
          unloaded && unloaded.processor(this.module, this.scope, null);
          this.state = "unloaded";
        }
      }
      updateEventHandler(event, name, processor, decorators) {
        if (!name) {
          const { current, inside, every, some, prevent, stop, stopImmediate } =
              decorators,
            { type, target, currentTarget } = event,
            isCurrent = Object.is(target, currentTarget); // TODO: outside support
          warner(
            [
              `Please avoid using "current" and "inside" decorators together on "+${type}" directive on element "%o".`,
              currentTarget,
            ],
            !(current && inside)
          );
          if (
            !(
              (!(current || inside) ||
                (current && isCurrent) ||
                (inside && currentTarget.contains(target) && !isCurrent)) &&
              modifierResolver(event, every, "every") &&
              modifierResolver(event, some, "some")
            )
          ) {
            return;
          }
          prevent && event.preventDefault();
          stop && event.stopPropagation();
          stopImmediate && event.stopImmediatePropagation();
        }
        const suspendedController = currentController,
          remove = decorators.remove;
        currentController = null;
        const data = processor(
          this.node,
          name ? dataUpdater[name](this.node, decorators, event) : event
        );
        remove &&
          (data instanceof Promise
            ? data.then((data) => this.removeDirectives(data, remove))
            : this.removeDirectives(data, remove));
        currentController = suspendedController;
      }
    }
  ) => {
    NodeContext.prototype.updateController = ((
      queueingControllerSet = new Set(),
      processor = (nodeContext, controller, force) => {
        if (!nodeContext.profile) {
          return;
        }
        const {
            decorators: { once, remove, router, lazy },
            topologySet,
            updater,
            name,
          } = controller,
          subscribable = !once || lazy;
        if (
          force ||
          (topologySet &&
            [...topologySet].some(
              (topology) => !Object.is(topology.oldValue, topology.value)
            ))
        ) {
          if (topologySet && topologySet.size) {
            topologySet.forEach((topology) => topology.unsubscribe(controller)); // TODO: optimize with cache
            originalSetClear.call(topologySet);
          }
          const suspendedController = currentController;
          currentController = subscribable ? controller : null;
          const data = controller.processor(nodeContext.node);
          subscribable && router && routerTopology.subscribe();
          currentController = suspendedController;
          if (lazy && !name) {
            // lazy watch
            controller.processor = data;
            controller.decorators.lazy = false;
            return;
          }
          data instanceof Promise
            ? data.then(
                (data) => (
                  remove && nodeContext.removeDirectives(data, remove),
                  updater &&
                    updater(data, nodeContext.node, nodeContext, controller)
                )
              )
            : (remove && nodeContext.removeDirectives(data, remove),
              updater &&
                updater(data, nodeContext.node, nodeContext, controller));
        }
      }
    ) =>
      function (controller, force) {
        if (!queueingControllerSet.has(controller)) {
          originalSetAdd.call(queueingControllerSet, controller);
          promisor.then(() => {
            originalSetDelete.call(queueingControllerSet, controller);
            processor(this, controller, force);
          });
        }
      })();
    return NodeContext;
  })(),
  NodeProfile = ((
    directiveType = { $: "controller", "+": "event" },
    interactiveDirectiveNames = hashTableResolver(
      "checked",
      "file",
      "focus",
      "result",
      "selected",
      "value"
    ),
    lifeCycleDirectiveNames = hashTableResolver(
      "loading",
      "loaded",
      "sentry",
      "unloading",
      "unloaded"
    ),
    rawElementNames = hashTableResolver("STYLE", "SCRIPT"),
    caseResolver = (content) =>
      content.includes("-")
        ? content
            .trim()
            .replace(/-[a-z]/g, (string) => string[1].toUpperCase())
            .replace(/-[A-Z]/g, (string) => `-${string[1].toLowerCase()}`)
        : content,
    dataBinder = (directives, value, fields, event) =>
      directives.eventHandlers.push(
        directiveResolver(
          `Object.is(${value}, _$data_) || (${value} = _$data_)`,
          Object.assign({ event }, fields),
          "$node, _$data_"
        )
      ),
    decoratorsResolver = (expression) =>
      ((
        safeDataResolver = (expression) => {
          try {
            return expression
              ? window[expression] || functionResolver(expression)
              : expression;
          } catch (error) {
            return expression;
          }
        }
      ) => {
        const [name, ...rawDecorators] = caseResolver(expression).split("#"),
          decorators = emptier();
        forEach(
          rawDecorators.filter((decorator) => decorator),
          (decorator) => {
            const [name, value] = decorator
              .split(":")
              .map((content) => decodeURIComponent(content));
            decorators[name] = value ? safeDataResolver(value) : true;
          }
        );
        return { name, decorators };
      })(),
    directiveAttributeResolver = (node, name, value = "") => {
      node.removeAttribute(name);
      node.setAttribute(
        `${directiveType[name[0]] || "meta"}-${decodeURIComponent(
          name.substr(1)
        )
          .trim()
          .replace(/[^\w]/g, "-")}-debug`,
        value
      );
    },
    directiveResolver = (
      (baseSignature = "$module, $scope") =>
      (expression, fields, signature = "$node") => {
        expression = `${
          signature ? `(${baseSignature}, ${signature})` : `(${baseSignature})`
        } => { with ($module) with ($scope) return (() => { 'use strict'; return ${expression}; })(); }`;
        const processor = processorCaches[expression];
        const directive = Object.assign({}, fields, {
          processor: processor || expression,
        });
        processor || directiveObjects.push(directive);
        return directive;
      }
    )(),
    templateResolver = (tagName, namespace) => {
      asserter(`There is no valid module named "${tagName}" found`, namespace);
      let isVirtualElement = false,
        promise = namespace.promise;
      if (namespace) {
        promise = namespace.fetch(tagName);
        if (promise) {
          isVirtualElement = true;
        } else {
          return templateResolver(tagName, namespace.parent);
        }
      }
      return { promise, isVirtualElement };
    },
    NodeProfile = class {
      constructor(
        node,
        basePaths = [],
        rootNodeProfiles = null,
        parent = null,
        unique = false,
        defaultSlotScope = null
      ) {
        (this.node = node),
          (this.unique = unique),
          (this.paths = basePaths),
          (this.defaultSlotScope =
            defaultSlotScope || (parent || {}).defaultSlotScope || null),
          (this.dynamic = this.plain = this.raw = this.virtual = false),
          (this.text =
            this.inlineStyle =
            this.styles =
            this.directives =
            this.landmark =
            this.children =
            this.classNames =
            this.html =
            this.slotScope =
              null);
        const type = node.nodeType;
        if (Object.is(type, Node.TEXT_NODE)) {
          const resolvedTextContent = node.textContent.trim();
          if (!resolvedTextContent) {
            return;
          }
          if (
            resolvedTextContent.includes("${") &&
            resolvedTextContent.includes("}")
          ) {
            rootNodeProfiles && rootNodeProfiles.push(this);
            (this.text = directiveResolver(
              `\`${resolvedTextContent}\``,
              { name: "text" },
              ""
            )),
              (this.promises = []),
              (this.node = this.resolveLandmark(
                node,
                "string template replaced"
              ));
          } else {
            this.raw = true;
          }
          parent.children.push(this);
        } else if (Object.is(type, Node.ELEMENT_NODE)) {
          this.promises = [];
          const cloak = "dg-cloak",
            { attributes, tagName } = node,
            rawDirective = "@raw",
            raw = attributes[rawDirective];
          (this.html = node.isSameNode(document.documentElement) && node),
            (this.raw = !!(raw || rawElementNames[tagName]));
          if (this.raw) {
            raw && directiveAttributeResolver(node, rawDirective);
            rootNodeProfiles && node.removeAttribute(cloak);
          } else {
            const controllers = [],
              eventHandlers = [],
              directives = { controllers, eventHandlers },
              name = tagName.toLowerCase(),
              namespace = rootNamespace.fetchSync([...this.paths]),
              { promise = null, isVirtualElement = false } =
                (node instanceof HTMLUnknownElement &&
                  templateResolver(name, namespace)) ||
                {},
              dynamicDirective = "@directive",
              dynamic = attributes[dynamicDirective],
              isTemplate = Object.is(name, "template"),
              slotDirective = "@slot";
            if (node.hasAttribute(slotDirective)) {
              const slotValue = node.getAttribute(slotDirective).trim(),
                slotName = `_$slot_${slotValue}`;
              directiveAttributeResolver(node, slotDirective, slotValue);
              if (this.defaultSlotScope) {
                this.defaultSlotScope[slotName] = node.innerHTML;
                warner(
                  [
                    `Please avoid adding "$html" or "$text" directive on element "%o" as it's defined "${slotDirective}" meta directive already`,
                    node,
                  ],
                  !node.hasAttribute("$html") && !node.hasAttribute("$text")
                );
                node.removeAttribute("$html");
                node.removeAttribute("$text");
                this.resolveDirective("$html", slotName, directives);
              }
            }
            if (isVirtualElement || isTemplate) {
              this.virtual = true;
              this.resolveLandmark(node, "virtual node removed");
            }
            forEach([...attributes], ({ name, value }) =>
              this.resolveDirective(name, value, directives)
            );
            if (dynamic) {
              (this.directives = directives),
                (this.dynamic = directiveResolver(dynamic.value));
              node.removeAttribute(dynamicDirective);
            } else {
              controllers.length || (directives.controllers = null);
              eventHandlers.length || (directives.eventHandlers = null);
              (directives.controllers ||
                directives.eventHandlers ||
                Object.values(directives).length > 2) &&
                (this.directives = directives);
            }
            if (this.html) {
              return processorResolver();
            }
            this.plain = !(this.directives || this.landmark);
            rootNodeProfiles &&
              (this.plain
                ? (node.hasAttribute(cloak) &&
                    forEach(node.children, (child) =>
                      child.setAttribute(cloak, "")
                    )) ||
                  node.removeAttribute(cloak)
                : rootNodeProfiles.push(this) && (rootNodeProfiles = null));
            if (isVirtualElement) {
              asserter(
                `It is illegal to use "$html" or "$text" directive on template module "${name}"`,
                !directives.child
              ); // TODO
              this.promises.push(
                promise.then((moduleProfile) =>
                  this.resolveTemplate(moduleProfile)
                )
              );
            } else if (!directives.child) {
              this.resolveChildren(node, rootNodeProfiles);
            }
          }
          if (parent) {
            parent.children.push(this);
            this.promises.length &&
              parent.promises.push(Promise.all(this.promises));
          }
        } else if (Object.is(type, Node.DOCUMENT_FRAGMENT_NODE)) {
          this.promises = [];
          this.resolveChildren(node, rootNodeProfiles);
        } else if (Object.is(type, Node.COMMENT_NODE)) {
          this.raw = true;
        } else {
          asserter(`The node type "${type}" is not supported`);
        }
      }
      resolveChildren(node, rootNodeProfiles) {
        const childNodes = this.virtual
          ? node.content.childNodes
          : node.childNodes;
        if (childNodes.length) {
          this.children = [];
          forEach(childNodes, (childNode) =>
            Reflect.construct(NodeProfile, [
              childNode,
              this.paths,
              rootNodeProfiles,
              this,
              !!this.unique,
            ])
          );
          this.plain &&
            this.children.every((child) => child.raw) &&
            (this.raw = true) &&
            (this.plain = false);
        } else if (this.plain) {
          (this.raw = true) && (this.plain = false);
        }
        this.raw && (this.children = null);
        return this;
      }
      resolveDirective(attributeName, value, directives) {
        const resolvedType = directiveType[attributeName[0]];
        if (!resolvedType) {
          return;
        }
        const node = this.node;
        directiveAttributeResolver(node, attributeName, value);
        node.removeAttribute(attributeName);
        const fields = {},
          { name, decorators } = decoratorsResolver(attributeName.substring(1));
        fields.decorators = decorators;
        if (Object.is(resolvedType, "event")) {
          fields.event = name;
          if (lifeCycleDirectiveNames[name]) {
            directives[name] = directiveResolver(
              value,
              fields,
              Object.is(name, "sentry") ? "$nextRouter" : "$node"
            );
          } else {
            fields.options = decorators;
            directives.eventHandlers.push(
              directiveResolver(value, fields, "$node, $event")
            );
          }
        } else {
          const isWatch = Object.is(name, "watch");
          isWatch || (fields.name = name);
          isWatch &&
            decorators.lazy &&
            (value = `${
              value
                .substring(value.indexOf("(") + 1, value.lastIndexOf(")"))
                .trim() || "null"
            }, $node => ${value}`);
          const directive = directiveResolver(value, fields);
          if (Object.is(name, "each")) {
            asserter(
              [
                `It is illegal to use "$each" directive with "id" attribute together on node "%o"`,
                node,
              ],
              !node.hasAttribute("id")
            );
            directives.each = directive;
            this.resolveLandmark(node, '"$each" node replaced');
            this.unique = false;
          } else if (Object.is(name, "exist")) {
            directives.exist = directive;
            this.resolveLandmark(node, '"$exist" node replaced');
            this.unique = false;
          } else if (Object.is(name, "html") || Object.is(name, "text")) {
            warner(
              [
                `Please avoid adding "$html" and "$text" directives together on element "%o"`,
                node,
              ],
              !directives.child
            );
            directives.child = directive;
          } else {
            if (Object.is(name, "class")) {
              this.classNames ||
                (node.classList.length &&
                  (this.classNames = [...node.classList].map((className) =>
                    className.trim()
                  )));
            } else if (Object.is(name, "style")) {
              if (!this.styles) {
                const style = node.style,
                  styleKeys = [...style];
                if (styleKeys.length) {
                  this.inlineStyle = node.getAttribute("style");
                  this.styles = emptier();
                  forEach(styleKeys, (key) => {
                    const value = style[key],
                      priority = style.getPropertyPriority(key);
                    this.styles[key] = priority
                      ? `${value} !${priority}`
                      : value;
                  });
                }
              }
            } else if (interactiveDirectiveNames[name]) {
              // two-way data binding
              const isValueDirective = Object.is(name, "value");
              if (!decorators.oneway) {
                fields.options = true; // useCapture
                const { tagName, type } = node,
                  isCheckedDirective = Object.is(name, "checked"),
                  isSelectedDirective = Object.is(name, "selected"),
                  isCheckedType =
                    Object.is(type, "checkbox") || Object.is(type, "radio"),
                  isFileType = Object.is(type, "file");
                if (Object.is(name, "focus")) {
                  dataBinder(directives, value, fields, "blur");
                  dataBinder(directives, value, fields, "focus");
                } else if (
                  (Object.is(tagName, "INPUT") &&
                    ((isFileType &&
                      (Object.is(name, "file") || Object.is(name, "result"))) ||
                      (isCheckedType &&
                        (isCheckedDirective || isSelectedDirective)) ||
                      (!isCheckedType && !isFileType && isValueDirective))) ||
                  (Object.is(tagName, "OPTION") && isCheckedDirective) ||
                  (Object.is(tagName, "SELECT") && isSelectedDirective) ||
                  (Object.is(tagName, "TEXTAREA") && isValueDirective)
                ) {
                  dataBinder(
                    directives,
                    value,
                    fields,
                    decorators.input ? "input" : "change"
                  );
                }
              }
              if (isValueDirective) {
                return directives.controllers.unshift(directive);
              }
            }
            directives.controllers.push(directive);
          }
        }
      }
      resolveLandmark(node, message) {
        if (this.landmark) {
          return;
        }
        this.landmark = textNode.cloneNode(false);
        this.promises.push(
          promisor.then(() => node.replaceWith(this.landmark) || message)
        );
        return this.landmark;
      }
      resolveTemplate(moduleProfile) {
        const module = moduleProfile.module;
        let cachedFields = templateCacheMap.get(module);
        if (!cachedFields) {
          cachedFields = emptier();
          const isTemplate = module instanceof NodeProfile,
            template = isTemplate
              ? module
              : (
                  (moduleProfile.children || []).find((moduleProfile) =>
                    Object.is(moduleProfile.name, "template")
                  ) || {}
                ).module;
          asserter(
            `"${moduleProfile.path}" or "${moduleProfile.path}.template" is not a valid template module`,
            template instanceof NodeProfile
          );
          cachedFields.children = template.children;
          cachedFields.defaultSlotScope = template.defaultSlotScope;
          originalWeakMapSet.call(templateCacheMap, module, cachedFields);
          isTemplate ||
            originalWeakMapSet.call(templateCacheMap, template, cachedFields);
        }
        Object.assign(this, cachedFields);
        if (Object.keys(this.defaultSlotScope).length) {
          const slotScope = {},
            emptySlot = "_$slot_",
            slotDirective = "@slot";
          forEach(this.node.children, (container) => {
            if (container.hasAttribute(slotDirective)) {
              const slotValue = container.getAttribute(slotDirective).trim(),
                slotName = `${emptySlot}${slotValue}`;
              directiveAttributeResolver(container, slotDirective, slotValue);
              slotScope[slotName] = Object.is(container.tagName, "TEMPLATE")
                ? container.innerHTML
                : container.outerHTML;
            }
          });
          Reflect.has(this.defaultSlotScope, emptySlot) &&
            !Reflect.has(slotScope, emptySlot) &&
            (slotScope[emptySlot] = this.node.innerHTML);
          this.slotScope = Object.assign({}, this.defaultSlotScope, slotScope);
        }
        return "";
      }
    }
  ) => NodeProfile)(),
  Topology = class {
    constructor(parent, name, value) {
      (this.value = this.oldValue = value),
        (this.parent = null),
        (this.controllerSet = new Set()),
        (this.children = emptier()),
        (this.name = name);
      if (parent) {
        parent.children[name] = this;
        this.parent = parent;
      }
    }
    dispatch(source = dispatchSource.bubble) {
      asserter(
        `It's illegal to modify fields of "$router"`,
        isRouterWritable || !Object.is(routerTopology, this.parent)
      );
      Object.is(source, dispatchSource.mutation) ||
        (this.parent &&
          this.parent.parent &&
          this.parent.dispatch(dispatchSource.bubble));
      const force = Object.is(source, dispatchSource.bubble);
      this.value && this.value[meta]
        ? this.value[meta].forEach((topology) => topology.trigger(force))
        : this.trigger(force);
    }
    fetch(name, value) {
      const topology = this.children[name] || new Topology(this, name, value);
      value && value[meta] && originalSetAdd.call(value[meta], topology);
      return topology;
    }
    subscribe() {
      if (currentController) {
        originalSetAdd.call(currentController.topologySet, this);
        originalSetAdd.call(this.controllerSet, currentController);
        const parent = this.parent;
        parent && parent.parent && parent.unsubscribe(currentController);
      }
      return this;
    }
    trigger(force) {
      this.controllerSet.size
        ? this.controllerSet.forEach((controller) =>
            controller.owner.updateController(controller, force)
          ) || promisor.then(() => (this.oldValue = this.value))
        : (this.oldValue = this.value);
    }
    unsubscribe(controller) {
      originalSetDelete.call(controller.topologySet, this);
      originalSetDelete.call(this.controllerSet, controller);
    }
    update(newValue, source) {
      const value = this.value;
      if (Object.is(value, newValue)) {
        return;
      }
      value instanceof Object &&
        Reflect.has(value, meta) &&
        originalSetDelete.call(value[meta], this);
      newValue instanceof Object &&
        Reflect.has(newValue, meta) &&
        originalSetAdd.call(newValue[meta], this);
      this.value = newValue;
      this.dispatch(source);
      if (Object.is(newValue) && this.parent) {
        Reflect.deleteProperty(this.parent.children, this.name);
        this.parent = null;
      }
      forEach(ownKeys(this.children), (key) =>
        this.children[key].update(
          (newValue || emptyObject)[key],
          dispatchSource.mutation
        )
      );
    }
  },
  runtime = ((
    base = "",
    currentStyleSet = null,
    routers = null,
    resolvedRouters = null,
    rootRouter = null,
    routerOptions = null,
    styleModules = { "": styleModuleSet },
    relativeLinkResolver = (
      (tagNames = hashTableResolver("A", "AREA")) =>
      (event) => {
        const node = event.target;
        if (!tagNames[node.tagName] || !node.hasAttribute("href")) {
          return;
        }
        const href = node.getAttribute("href").trim();
        if (Object.is(routerOptions.mode, "history")) {
          event.preventDefault();
          history.pushState({}, "", href);
          routeChangeResolver();
        } else {
          const prefix = routerOptions.prefix;
          href &&
            ![prefix, ".", "/"].some((prefix) => href.startsWith(prefix)) &&
            !Object.is(href, new URL(href, document.baseURI).href) &&
            (node.href = `${prefix}${href}`);
        }
      }
    )(),
    routeChangeResolver = (
      (
        routerChangeResolver = (
          (
            rootNamespaceResolver = (nextRouter) => {
              logger(
                `router has changed from "${
                  (rootScope.$router || {}).path || "[root]"
                }" to "${nextRouter.path}"`
              );
              processorResolver();
              isRouterWritable = true;
              rootScope.$router = nextRouter;
              isRouterWritable = false;
              if (!currentStyleSet) {
                rootNodeProfiles.map(
                  (nodeProfile) => new NodeContext(nodeProfile)
                );
                routerTopology = [...rootScope.$router[meta]][0];
              }
              if (!Object.is(currentStyleSet, styleModuleSet)) {
                currentStyleSet &&
                  currentStyleSet.forEach(
                    (style) => (
                      (style.disabled = !styleModuleSet.has(style)),
                      style.setAttribute("active-debug", !style.disabled)
                    )
                  );
                styleModuleSet.forEach(
                  (style) => (
                    (style.disabled = false),
                    style.setAttribute("active-debug", true)
                  )
                );
                currentStyleSet = styleModuleSet;
              }
            }
          ) =>
          (nextRouter) => {
            logger(
              `router is changing from "${
                (rootScope.$router || {}).path || "[root]"
              }" to "${nextRouter.path}"...`
            );
            rootNamespace.childrenCache = emptier();
            // originalMapClear.call(templateCacheMap);
            const path = nextRouter.path;
            styleModuleSet =
              styleModules[path] || (styleModules[path] = new Set());
            const rootModules = Object.assign(
              emptier(),
              ...resolvedRouters.map((router) => router.modules)
            );
            forEach(
              Object.keys(rootModules),
              (key) =>
                rootModules[key] instanceof ModuleProfile ||
                (rootModules[key] = routers.find((router) =>
                  router.resolveModule(key, base)
                ).modules[key])
            );
            rootNamespace = new ModuleProfile(
              { content: rootModules, type: resolvedType.namespace },
              base
            );
            return rootNamespace
              .resolve()
              .then(() => rootNamespaceResolver(nextRouter));
          }
        )()
      ) =>
      (
        route = (Object.is(routerOptions.mode, "history")
          ? `${location.pathname}${location.search}`
          : location.hash
        ).replace(routerOptions.prefix, "")
      ) => {
        const slash = "/";
        route.startsWith(slash) || (route = `${slash}${route}`);
        const { mode, aliases, prefix, redirects } = routerOptions,
          [path = "", query = ""] = route.split("?"),
          redirectPath = aliases[path] || redirects[path];
        if (redirectPath) {
          logger(`router redirected from "${path}" to "${redirectPath}"`);
          route = query ? `${redirectPath}?${query}` : redirectPath;
          aliases[path] ||
            history.replaceState({ path: route }, "", `${prefix}${route}`);
          return routeChangeResolver(route);
        }
        const scenarios = {},
          paths = Object.is(path, slash) ? [""] : path.split(slash);
        routers = [];
        if (!rootRouter.match(routers, scenarios, paths)) {
          if (Reflect.has(routerOptions, "default")) {
            warner(
              `The router "${path}" is invalid, redirect to the default router "${routerOptions.default}"`
            );
            return routeChangeResolver(routerOptions.default);
          } else {
            asserter(`The router "${path}" is invalid`);
          }
        }
        resolvedRouters = routers.slice().reverse();
        forEach(resolvedRouters, (router) => router.initialize());
        const queries = {},
          variables = Object.assign(
            {},
            ...resolvedRouters.map((router) => router.variables)
          ),
          constants = Object.assign(
            {},
            ...resolvedRouters.map((router) => router.constants)
          );
        query &&
          forEach(
            [...new URLSearchParams(query)],
            ([key, value]) => (queries[key] = value)
          );
        forEach(Object.keys(variables), (key) => {
          if (Reflect.has(queries, key) && !Reflect.has(constants, key)) {
            try {
              const type = typeof variables[key],
                query = queries[key];
              variables[key] = Object.is(type, "string")
                ? query
                : window[`${type[0].toUpperCase()}${type.substring(1)}`](
                    JSON.parse(query)
                  );
            } catch (error) {
              asserter(
                `The expected variable type is "${type}" but the real queryString content is "${query}"`
              );
            }
          }
        });
        const nextRouter = {
          mode,
          prefix,
          path,
          paths,
          query,
          queries,
          scenarios,
          schemes: Object.assign({}, variables, constants),
        };
        Promise.all(
          [...sentrySet].map(
            (sentry) =>
              sentry.processor(nextRouter) &&
              (warner([
                `The router redirect is prevented by "%o"`,
                sentry.owner.node || sentry.owner.profile.node,
              ]) ||
                true)
          )
        ).then((array) =>
          array.some((rejected) => rejected)
            ? history.replaceState(
                null,
                "",
                `${prefix}${rootScope.$router.path}`
              )
            : routerChangeResolver(nextRouter)
        );
      }
    )(),
    resetEventHandler = (
      (
        resetToken = { detail: true },
        changeEvent = new CustomEvent("change", resetToken),
        inputEvent = new CustomEvent("input", resetToken)
      ) =>
      (event) =>
        Object.is(event.target.tagName, "FORM") &&
        forEach(
          querySelector(document.body, "input, textarea", true, true),
          (child) => {
            child.dispatchEvent(inputEvent);
            child.dispatchEvent(changeEvent);
          }
        )
    )(),
    Router = class {
      constructor(
        {
          children,
          path = "",
          constants = {},
          variables = {},
          modules = null,
          tailable = false,
        },
        parent = null
      ) {
        (this.constants = constants),
          (this.variables = variables),
          (this.modules = modules),
          (this.children = null),
          (this.parent = parent);
        this.scenarios =
          path instanceof Object
            ? Object.keys(path).map((scenario) => ({
                scenario,
                regExp: new RegExp(path[scenario] || "^$"),
              }))
            : [{ scenario: path, regExp: new RegExp(`^${path}$`) }];
        this.initialized = false;
        if (children) {
          asserter(
            [
              `The router's children should be "array" instead of "%o"`,
              children,
            ],
            Array.isArray(children)
          );
          this.children = children
            .filter((child) => {
              try {
                return (
                  !Reflect.has(child, "match") ||
                  matchMedia(child.match).matches ||
                  functionResolver(child.match)
                );
              } catch (error) {
                return false;
              }
            })
            .map((child) => new Router(child, this));
        }
        this.tailable = tailable || !(this.children || []).length;
      }
      initialize() {
        if (this.initialized) {
          return;
        }
        this.initialized = true;
        this.modules &&
          (this.modules = ModuleProfile.normalizeConfig(this.modules));
      }
      match(routers, scenarios, paths, length = paths.length, start = 0) {
        const scenarioLength = this.scenarios.length;
        if (
          length >= scenarioLength &&
          this.scenarios.every(({ scenario, regExp }, index) => {
            const path = paths[start + index];
            if (regExp.test(path)) {
              scenarios[scenario] = path;
              return true;
            }
          })
        ) {
          start += scenarioLength;
          return (
            ((Object.is(length, start) && this.tailable) ||
              (this.children || []).find((child) =>
                child.match(routers, scenarios, paths, length, start)
              )) &&
            routers.push(this)
          );
        }
      }
      resolveModule(key, base) {
        if (this.modules) {
          const module = this.modules[key];
          this.modules[key] =
            module &&
            (module instanceof ModuleProfile
              ? module
              : new ModuleProfile(module, base, key));
          return this.modules[key];
        }
      }
    }
  ) => {
    rootScope = Object.seal(
      proxyResolver({
        $router: null,
        $validator: (data, path, { type, assert, required } = {}) => {
          if (data == null || Number.isNaN(data)) {
            asserter(
              [
                `The data "${path}" should be assigned a valid value instead of "%o" before using`,
                data,
              ],
              !required
            );
          }
          type &&
            (Array.isArray(type)
              ? asserter(
                  [
                    `The type of data "${path}" should be one of "%o" instead of "%o"`,
                    type,
                    (data.constructor || {}).name,
                  ],
                  type.some((type) => data instanceof type)
                )
              : asserter(
                  [
                    `The type of data "${path}" should be "%o" instead of "%o"`,
                    type,
                    (data.constructor || {}).name,
                  ],
                  data instanceof type
                ));
          if (!assert) {
            return;
          }
          if (assert instanceof Function) {
            asserter(`The assert of "${path}" is falsy`, assert(data));
          } else if (Array.isArray(assert)) {
            forEach(assert, (func) => {
              asserter(
                `The type of assert should be "function" instead of "${typeof func}"`,
                func instanceof Function
              );
              asserter(`The assert of "${path}" is falsy`, func(data));
            });
          } else {
            asserter(
              `The type of assert should be "function" or "function array" instead of "${typeof assert}"`
            );
          }
        },
      })
    );
    const register = (
      (
        resolver = (prototype, name) => {
          const method = (prototype || {})[name];
          asserter(
            [
              `"${name}" is not a valid method name of prototype object "%o"`,
              prototype,
            ],
            method && method instanceof Function
          );
          const resolvedMethod = function (...parameters) {
            const result = method.apply(this, parameters);
            this[meta] && this[meta].forEach((topology) => topology.dispatch());
            return result;
          };
          Reflect.defineProperty(resolvedMethod, "name", {
            configurable: true,
            value: name,
          });
          Reflect.defineProperty(prototype, name, {
            get: () => resolvedMethod,
          });
        }
      ) =>
      (target, names) => {
        asserter(
          [
            `The 1st argument of "$dagger.register" should be valid "object" instead of "%o"`,
            target,
          ],
          target instanceof Object
        );
        asserter(
          [
            `The 2nd argument of "$dagger.register" should be "string array" instead of "%o"`,
            names,
          ],
          Array.isArray(names) && names.every((name) => isString(name))
        );
        forEach(names, (name) => resolver(target.prototype, name));
      }
    )();
    register(Date, [
      "setDate",
      "setFullYear",
      "setHours",
      "setMilliseconds",
      "setMinutes",
      "setMonth",
      "setSeconds",
      "setTime",
      "setUTCDate",
      "setUTCFullYear",
      "setUTCHours",
      "setUTCMilliseconds",
      "setUTCMinutes",
      "setUTCMonth",
      "setUTCSeconds",
      "setYear",
    ]) ||
      register(Map, ["set", "delete", "clear"]) ||
      register(Set, ["add", "delete", "clear"]) ||
      register(WeakMap, ["set", "delete"]) ||
      register(WeakSet, ["add", "delete"]);
    JSON.stringify = processorWrapper(JSON.stringify);
    forEach(
      [
        "concat",
        "copyWithin",
        "fill",
        "find",
        "findIndex",
        "lastIndexOf",
        "pop",
        "push",
        "reverse",
        "shift",
        "unshift",
        "slice",
        "sort",
        "splice",
        "includes",
        "indexOf",
        "join",
        "keys",
        "entries",
        "values",
        "forEach",
        "filter",
        "flat",
        "flatMap",
        "map",
        "every",
        "some",
        "reduce",
        "reduceRight",
        "toLocaleString",
        "toString",
        "at",
      ],
      (key) => (Array.prototype[key] = processorWrapper(Array.prototype[key]))
    );
    const runtime = (configs = { base: document.baseURI, content: {} }) => {
      // TODO: base
      logger(`Powered by "dagger V${$dagger.version}".`);
      const content = configs.content;
      if (content.routing) {
        content.routing = Object.assign(daggerOptions.routing, content.routing);
        Object.assign(daggerOptions, content);
      } else {
        daggerOptions.routing.scenarios = { modules: content };
      }
      routerOptions = daggerOptions.routing;
      Object.is(routerOptions.mode, "history") ||
        routerOptions.prefix ||
        (routerOptions.prefix = "#");
      const rootModules = emptier();
      document.body.addEventListener("click", relativeLinkResolver, true);
      document.body.addEventListener("reset", resetEventHandler);
      (base = configs.base),
        (rootRouter = new Router(routerOptions.scenarios)),
        rootRouter.initialize();
      forEach(
        Object.keys(rootRouter.modules || {}),
        (key) => (rootModules[key] = rootRouter.resolveModule(key, base))
      );
      rootNamespace = Reflect.construct(ModuleProfile, [
        { content: rootModules, type: resolvedType.namespace },
        base,
      ]);
      rootNamespace.resolve().then(
        () =>
          styleModuleSet.forEach((style) => (style.disabled = false)) ||
          serializer([
            new NodeContext(new NodeProfile(document.documentElement)).promise,
            () => {
              const rootSelectors = daggerOptions.rootSelectors;
              asserter(
                [
                  `The "rootSelectors" should be "string array" instead of "%o"`,
                  rootSelectors,
                ],
                Array.isArray(rootSelectors) &&
                  rootSelectors.every((selector) => isString(selector))
              );
              const rootNodes = [
                ...new Set(
                  rootSelectors
                    .map((rootSelector) => [
                      ...querySelector(document, rootSelector, true),
                    ])
                    .flat()
                ),
              ];
              asserter(
                [
                  'It\'s illegal to set "%o" as root node',
                  document.documentElement,
                ],
                !rootNodes.includes(document.documentElement)
              );
              forEach(rootNodes, (rootNode) =>
                Reflect.construct(NodeProfile, [
                  rootNode,
                  [],
                  rootNodeProfiles,
                  null,
                  true,
                ])
              );
              warner(
                [
                  'No node with valid directive was detected under root elements "%o"',
                  rootNodes,
                ],
                rootNodeProfiles.length
              );
              window.addEventListener("popstate", () => routeChangeResolver());
              routeChangeResolver();
            },
          ])
      );
    };
    window.$dagger = Object.freeze(
      Object.assign(emptier(), { register, runtime, version: "1.0.0 - RC" })
    );
    return runtime;
  })()
) =>
  querySelector(document, 'script[type="dagger/configs"]')
    ? document.addEventListener("DOMContentLoaded", () =>
        serializer([
          configResolver(document, document.baseURI),
          (configs) => runtime(configs),
        ])
      )
    : runtime)();
