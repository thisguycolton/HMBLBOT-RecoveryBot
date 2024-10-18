Rails.application.routes.draw do
  resources :user_active_groups, only: %i[create update]

  resources :groups do
    resources :meetings
  end
  get 'host_helper/scratchpaper'
  resources :polls do
    resources :options
  end

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
