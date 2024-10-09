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
pin "bootstrap", to: 'bootstrap.min.js', preload: true
