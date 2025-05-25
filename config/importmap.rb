# Pin npm packages by running ./bin/importmap
# config/importmap.rb
pin "application", preload: true
pin "@hotwired/turbo-rails", to: "turbo.min.js", preload: true
pin "@hotwired/stimulus", to: "@hotwired--stimulus.js" # @3.2.2
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin "stimulus-dropdown" # @2.1.0
pin "hotkeys-js" # @3.13.7
pin "stimulus-use" # @0.51.3
pin_all_from "app/javascript/controllers", under: "controllers"
pin "@rails/request.js", to: "@rails--request.js.js" # @0.0.8
pin "@stimulus-components/sortable", to: "@stimulus-components--sortable.js" # @5.0.1
pin "sortablejs" # @1.15.3
pin "popper", to: 'popper.js', preload: true
pin "bootstrap", to: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
pin "@afomera/richer-text", to: "richer-text.js"
pin "pixi.js" # @8.8.1
pin "@pixi/colord", to: "@pixi--colord.js" # @2.9.6
pin "@pixi/colord/plugins/names", to: "@pixi--colord--plugins--names.js" # @2.9.6
pin "@xmldom/xmldom", to: "@xmldom--xmldom.js" # @0.8.10
pin "earcut" # @2.2.4
pin "eventemitter3" # @5.0.1
pin "ismobilejs" # @1.1.1
pin "parse-svg-path" # @0.1.2
pin "@afomera/richer-text", to: "richer-text.js"
pin "@rails/actioncable", to: "actioncable.esm.js"
pin "channels", preload: true
pin_all_from "app/javascript/channels", under: "channels"
