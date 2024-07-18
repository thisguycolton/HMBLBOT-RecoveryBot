Rails.application.routes.draw do
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
  resources :readings
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
   root "topics#index"
end
