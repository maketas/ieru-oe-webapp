App.Views.SearchResults = Backbone.View.extend({
    tagName: 'section',

    render: function(){
        this.$el.append( '<div class="app-content-pagination"></div>' );
        this.collection.each(function(resource){
            this.$el.append( new App.Views.Resource({ model: resource }).el );
        }, this);

        // Add pagination box
        this.$el.append( '<div class="app-content-pagination"></div>' );

        return this;
    }
});

    App.Views.Resource = Backbone.View.extend({
        tagName: 'article',

        className: 'clearfix',

        template: _.template( $('#resource-content').html() ),

        initialize: function(){
            this.render();
        },

        render: function(){
            // Get language to show of those in the resource
            var model = this.model.toJSON();
            if ( !!model.texts[Box.get('interface')] && model.texts[Box.get('interface')].title != '' )
                model.metadata_language = Box.get('interface');
            else if ( !!model.texts.en && model.texts.en.title != '' )
                model.metadata_language = 'en';
            else
                for ( var lang in model.texts )
                    if ( lang.title != '' )
                        model.metadata_language = lang;

            // Render view
            this.$el.html( this.template( model ) );
            return this;
        },
    });

App.Views.Facets = Backbone.View.extend({

    className: 'accordion',

    idName: 'facets-listing-ajax',

    render: function(){
        this.collection.each(function(facet){
            this.$el.append( new App.Views.Facet({ model: facet }).el );
        }, this);
        return this;
    }

});

    App.Views.Facet = Backbone.View.extend({
        tagName: 'div',

        className: 'accordion-group',

        template: _.template( $('#facets-content').html() ),

        initialize: function(){
            this.render();
        },

        render: function(){
            // Render the facet view
            this.$el.html( this.template( this.model.toJSON() ) );

            // Render the filters of this facet and append to this
            var filters = new App.Collections.Filters(this.model.get('results'));
            var filtersView = new App.Views.Filters({ collection: filters });
            this.$el.append('<div id="collapse-'+this.model.get('name')+'" class="accordion-body collapse in"><div class="accordion-inner"></div></div>')
                .find('.accordion-inner').append( filtersView.render().el );

            return this;
        },
    });

        App.Views.Filters = Backbone.View.extend({
            tagName: 'ul',
            className: 'list-unstyled',

            render: function(){
                this.collection.each(function(filter){
                    this.$el.append( new App.Views.Filter({ model: filter }).el );
                }, this);
                return this;
            }
        })
            App.Views.Filter = Backbone.View.extend({
                tagName: 'li',

                template: _.template( $('#facets-filter').html() ),

                initialize: function(){
                    this.render();
                },

                render: function(){
                    // Take the last part in technical format filters
                    var translation = this.model.get('translation').split('/');
                    this.model.set('translation', translation[translation.length-1]);

                    this.$el.html( this.template( this.model.toJSON() ) );
                    return this;
                }
            })

App.Views.Pagination = Backbone.View.extend({

    template: _.template( $('#search-pagination').html() ),

    render: function(){
        this.$el.html( this.template( this.model.toJSON() ) );
        return this;
    }

});

App.Views.DoSearch = Backbone.View.extend({
    el: '#search-form',

    events: {
        'submit': 'submit'
    },

    initialize: function(){

        // Submit search event
        vent.on( 'search:submit', function(text,page){
            // Remove elements not needed
            if ( !Box.get('searchText') || Box.get('searchText') != text || Box.get('page') != page ){
                $('#app-content-filters').empty();
                $('#app-content-results').empty();
                    Box.set('page',page);
                console.log(Box.get('page'))
                $('#header form').submit();
            }
        }, this );

        // Cancel any ongoing ajax requests
        vent.on( 'cancel:ajaxs', function(){
            if ( !!this.ajax ){
                this.ajax.abort();
                delete this.ajax;
            }
        }, this );

        // Search request was not successful
        vent.on( 'search:error', function(message){
            $('#app-content-results').html('<div class="alert alert-danger">'+message+'</div>');
        }, this );

        // Add event for key pressing in the search form
        $('#search-form input[type=text]').keyup(this.autocomplete);
    },

    autocomplete: function(e){
        console.log(e.type, e.keyCode);
    },

    submit: function(e){
        // Abort any current ajax requests
        e.preventDefault();
        vent.trigger('cancel:ajaxs');

        // Get the search text
        Box.set('searchText', $(e.currentTarget).find('input[type=text]').val());
        $('#app-content-filters').empty();
        $('#app-content-results').empty().html('<img src="/images/loading_edu.gif" />');

        // Change URL
        Router.navigate('#/search/'+Box.get('searchText')+'/'+Box.get('page'));

        // Do the search
        var request = { 
            text:   Box.get('searchText'), 
            lang:   Box.get('interface'),
            offset: (parseInt(Box.get('page'))-1)*Box.get('perPage'),
            limit:  Box.get('perPage'), 
            total:  0 
        }
        var search = new App.Models.Search(request);
        this.ajax = search.fetch();
        this.ajax.then(function(response){
            // On error
            if ( !response.success ){
                vent.trigger( 'search:error', response.message );
                return;
            }

            // Assign facets and results
            var facets = new App.Collections.Facets(search.get('data').facets);
            var resources = new App.Collections.Resources(search.get('data').resources);

            // Render the facets in the View
            var facetsView = new App.Views.Facets({ collection: facets });
            $('#app-content-filters').append(facetsView.render().el);

            // Render the results
            var resultsView = new App.Views.SearchResults({ collection: resources });
            $('#app-content-results').empty().append(resultsView.render().el);

            // Render the pagination
            var pagination = new App.Models.Pagination({ items: 120, perPage: 10, current: 2 });
            var paginationView = new App.Views.Pagination({ model: pagination });
            $('.app-content-pagination').empty().append(paginationView.render().el);
        });

        // Remove memory of request object
        delete App.Ajaxs.search;
    }
});