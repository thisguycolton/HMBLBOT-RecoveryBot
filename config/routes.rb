Rails.application.routes.draw do
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  resources :topic_sets
  resources :hostificators do
    member do
      get :results
      post :vote
    end
  end
  resources :court_verifications, only: :new

  resources :tags

  resources :hostificators, only: [:new, :create, :show] do
    post :vote, on: :member
  end

  get "/topicificator", to: "pages#topicificator"
  get "/library(/*path)", to: "pages#library"

  # Schedule polls: a React app (app/javascript/entrypoints/schedule_polls.jsx)
  get "/schedule_polls", to: "schedule_polls#app", as: :schedule_polls
  get "/schedule_polls/:token(/*path)", to: "schedule_polls#app", as: :schedule_poll

  get "game_server/getting_started"
  get "game_server/plugin_faq"


  namespace :api do
            resources :court_verifications, only: :create

  resources :text_reports, only: :create
  resources :site_notices, only: :index
  resource :profile, only: %i[show update]
  get "oiaa/search", to: "oiaa#search"
  get "oiaa/matches", to: "oiaa#matches"
  get "groups/find", to: "groups#find"
  post "groups/start", to: "groups#start"
  post "groups/join_with_token", to: "groups#join_with_token"
  post "groups/dismiss_prompt", to: "groups#dismiss_prompt"
  resources :groups, param: :slug, only: %i[index show create update destroy] do
    member do
      post :join
      post :leave
      post :approve
      post :regenerate_invite
      get :court_verifications
    end
    resources :memberships, controller: "group_memberships", only: %i[create update destroy]
    resources :books, controller: "group_books", only: %i[create update destroy]
    resources :meetings, controller: "group_meetings", only: %i[create update destroy] do
      post :unlink, on: :member
      collection do
        post :import
        post :refresh
      end
    end
  end
  get "schedule_polls/people", to: "schedule_polls#people"
  resources :schedule_polls, only: %i[index show create update destroy], param: :token do
    member do
      post :close
      post :reopen
      put :ballot, action: :vote
      delete :ballot, action: :unvote
      delete "ballots/:id", action: :remove_ballot
    end
  end
  resources :notifications, only: :index do
    post :read, on: :member
    post :read_all, on: :collection
  end
  resources :highlights, only: [:index, :create, :update, :destroy] do
    collection do
      post :share
      get :collection
    end
  end

  resources :books, param: :slug do
    collection do
      post :import_json         # => POST /api/books/import_json
      get :search, action: :search_all  # => GET /api/books/search?q=
    end

    member do
      get :export               # => GET /api/books/:slug/export
      get :search               # => GET /api/books/:slug/search?q=
      get :manage_chapters
    end

    resources :chapters, param: :slug, only: [:index, :show, :update, :create, :destroy] do
      collection do
        post :merge
        post :reorder
      end
    end

  end


  resources :topic_sets, only: [:index]

    namespace :v1 do
      # Quest Players
      resources :quest_players, only: [:create, :show, :index, :update, :destroy] do
        resources :quest_sessions, only: [:index, :create, :destroy]
        collection do
          post :create_by_screen_name
        end
      end

      # Quest Sessions
      resources :quest_sessions, only: [:create, :show, :index, :update, :destroy] do
        resources :quest_inventory, only: [:show, :update], singleton: true
        resources :log_entries, only: [:create], controller: "quest_log_entries"
        resources :stories, only: [:index, :create], controller: "quest_stories"
        member do
          get :journey
          get :log
          post :complete
        end
      end

      # ACID QUEST topic draws and sharing modes (read the Topicificator library)
      resources :sharing_modes, only: [:index]
      get "quest_topics/draw", to: "quest_topics#draw"
      get "quest_topics/categories", to: "quest_topics#categories"
      get "quest_topics/:id", to: "quest_topics#show", constraints: { id: /\d+/ }

      # Join Session by Code
      post '/join_session', to: 'quest_sessions#join_by_code'

      # Health Check
      get '/health', to: 'health#check'
    end
  end
namespace :api do
  # explicit collection endpoints
  get 'topics/by_number', to: 'topics#by_number'
  get 'topics/random',    to: 'topics#random'

  # only allow numeric IDs for :show so 'by_number' won't match here
  resources :topics, only: [:index, :show], constraints: { id: /\d+/ }

  resources :topic_sets, only: [:index, :show]
end
  resources :topic_categories
  resources :service_readings
  resources :icons, only: [:index, :show]
  get 'game/game'
  get 'game/world', to: 'game#world' # generated-world overview for tuning (?seed=N)
  get 'topics/by_category', to: 'topics#by_category'
  # Groups: a React app (app/javascript/entrypoints/groups.jsx); invite links join on the server
  get "/groups/join/:token", to: "groups#join", as: :join_group
  get "/groups", to: "groups#app", as: :groups
  get "/groups/*path", to: "groups#app", format: false
  get 'host_helper/scratchpaper'
  # config/routes.rb
  get "/books/:book_slug/chapters/:chapter_slug", to: "pages#reader"
  # A book's own page lives in the library; /books/<slug> used to 404.
  get "/books", to: redirect("/library")
  get "/books/:slug", to: redirect("/library/%{slug}"), constraints: { slug: /(?!new\z)[^\/]+/ }
  resources :polls do
    resources :options
  end
  mount ActionCable.server => '/cable'
  # AhoyCaptain (Ahoy's own dashboard) isn't mounted: its charts need Groupdate, which needs
  # ActiveRecord.default_timezone = :utc, and this app uses :local. The admin suite's
  # Analytics page covers the same data.

  resources :books, param: :slug, only: [] do
    resources :chapters, param: :slug, only: [:index, :show, :edit]
  end

  resources :topics
  # Your profile (React, app/javascript/entrypoints/profile.jsx) replaces Devise's edit page
  get "/users/edit", to: "profiles#show", as: :edit_profile
  devise_for :users

  namespace :admin_panel do
    # React app; every path below it routes on the client
    get "topicificator(/*path)", to: "topicificator#show", as: :topicificator
    resources :court_verifications, only: [] do
      get :print, on: :collection
    end
    # The admin suite, another React app: everything else under /admin_panel
    root "suite#show"
    get "*path", to: "suite#show", as: :suite, format: false
  end

  # JSON behind the Topicificator admin (admins only)
  namespace :api do
    namespace :admin do
      resource :meta, only: :show, controller: "meta"
      resources :topics, only: %i[index show create update destroy] do
        member do
          put "prompts/:mode_key", action: :save_prompt
          delete "prompts/:mode_key", action: :remove_prompt
        end
      end
      resources :topic_sets, only: %i[create update destroy]
      resources :topic_categories, only: %i[create update destroy]
      resources :court_verifications, only: :index do
        post :send_bundle, on: :collection
      end
      # the admin suite (Api::Admin::SuiteController)
      resource :overview, only: :show, controller: "overview"
      resource :analytics, only: :show
      resources :users, only: %i[index update] do
        patch :confirm, on: :member
      end
      resources :readings, only: %i[index update destroy]
      resources :tags, only: %i[index create update destroy]
      resources :site_notices, only: %i[index create update destroy]
      resources :text_reports, only: %i[index update destroy] do
        post :comment, on: :member
      end
    end
  end
  resources :readings do
    get :mine, on: :collection
  end
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
   root "pages#home"
end
