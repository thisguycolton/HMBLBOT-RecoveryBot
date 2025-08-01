Rails.application.routes.draw do
  resources :hostificators do
    member do
      get :results
      post :vote
    end
  end


  resources :hostificators, only: [:new, :create, :show] do
    post :vote, on: :member
  end

  get "/topicificator", to: "pages#topicificator"
  get "game_server/getting_started"
  get "game_server/plugin_faq"
  namespace :api do
    get 'topics/random', to: 'topics#random'
    get 'topics/:id', to: 'topics#show'
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
      end

      # Join Session by Code
      post '/join_session', to: 'quest_sessions#join_by_code'

      # Health Check
      get '/health', to: 'health#check'
    end
  end

  resources :topic_categories
  resources :service_readings
  resources :user_active_groups, only: %i[create update]
  resources :icons, only: [:index, :show]
  get 'game/game'
  get 'topics/by_category', to: 'topics#by_category'
  resources :groups do
    resources :meetings
  end
  get 'host_helper/scratchpaper'
  resources :polls do
    resources :options
  end
  mount ActionCable.server => '/cable'
  mount AhoyCaptain::Engine => '/ahoy_captain'

  resources :books do
    resources :pages, only: [:show], param: :page_number
    resources :chapters
  end
  resources :topics
  devise_for :users

  namespace :admin_panel do
    resources :users, only: [:index] do
      member do
        patch :confirm
      end
    end
  end
  resources :readings
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
   root "topics#index"
end
