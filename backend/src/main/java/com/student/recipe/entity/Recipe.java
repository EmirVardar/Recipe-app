package com.student.recipe.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "recipes")
public class Recipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long spoonacularId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 500)
    private String image;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Column
    private Integer servings;

    @Column
    private Integer readyInMinutes;

    @Column(length = 500)
    private String sourceUrl;

    @Column(length = 500)
    private String spoonacularSourceUrl;

    @Column
    private Double healthScore;

    @Column
    private Double pricePerServing;

    @Column
    private Boolean vegetarian;

    @Column
    private Boolean vegan;

    @Column
    private Boolean glutenFree;

    @Column
    private Boolean dairyFree;

    @Column
    private Boolean veryHealthy;

    @Column
    private Boolean cheap;

    @Column
    private Boolean veryPopular;

    @Column
    private Boolean sustainable;

    @Column
    private Boolean lowFodmap;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeIngredient> recipeIngredients = new ArrayList<>();

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeStep> recipeSteps = new ArrayList<>();

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeTag> recipeTags = new ArrayList<>();

    @OneToOne(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private RecipeNutrition recipeNutrition;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public void replaceIngredients(List<RecipeIngredient> ingredients) {
        recipeIngredients.clear();
        for (RecipeIngredient ingredient : ingredients) {
            ingredient.setRecipe(this);
            recipeIngredients.add(ingredient);
        }
    }

    public void replaceSteps(List<RecipeStep> steps) {
        recipeSteps.clear();
        for (RecipeStep step : steps) {
            step.setRecipe(this);
            recipeSteps.add(step);
        }
    }

    public void replaceTags(List<RecipeTag> tags) {
        recipeTags.clear();
        for (RecipeTag tag : tags) {
            tag.setRecipe(this);
            recipeTags.add(tag);
        }
    }

    public void replaceNutrition(RecipeNutrition nutrition) {
        if (nutrition == null) {
            this.recipeNutrition = null;
            return;
        }

        nutrition.setRecipe(this);
        this.recipeNutrition = nutrition;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
