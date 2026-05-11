package com.student.recipe.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.student.recipe.entity.Recipe;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    @Query("""
            select distinct r
            from Recipe r
            left join fetch r.recipeNutrition rn
            left join fetch r.recipeTags rt
            left join r.recipeIngredients ri
            left join ri.ingredient i
            where (
                    :query is null
                    or :query = ''
                    or lower(r.title) like lower(concat('%', :query, '%'))
                    or lower(coalesce(r.titleTr, '')) like lower(concat('%', :query, '%'))
                    or lower(i.name) like lower(concat('%', :query, '%'))
                    or lower(coalesce(i.nameTr, '')) like lower(concat('%', :query, '%'))
                  )
              and (:minCalories is null or rn.calories >= :minCalories)
              and (:maxCalories is null or rn.calories <= :maxCalories)
              and (:highProtein = false or rn.protein >= :proteinThreshold)
              and (:maxReadyInMinutes is null or r.readyInMinutes <= :maxReadyInMinutes)
              and (:vegetarian is null or r.vegetarian = :vegetarian)
              and (:vegan is null or r.vegan = :vegan)
              and (
                    :category is null
                    or :category = ''
                    or (
                        :category = 'main'
                        and not exists (
                            select 1
                            from RecipeTag rt2
                            where rt2.recipe = r
                              and rt2.tagType = 'dish_type'
                              and lower(rt2.tagValue) in ('dessert', 'salad', 'soup', 'breakfast', 'drink', 'snack', 'lunch', 'dinner')
                        )
                    )
                    or exists (
                        select 1
                        from RecipeTag rt3
                        where rt3.recipe = r
                          and rt3.tagType = 'dish_type'
                          and lower(rt3.tagValue) = lower(:category)
                    )
                  )
            order by r.createdAt desc
            """)
    List<Recipe> searchRecipes(
            @Param("query") String query,
            @Param("minCalories") Double minCalories,
            @Param("maxCalories") Double maxCalories,
            @Param("highProtein") boolean highProtein,
            @Param("proteinThreshold") Double proteinThreshold,
            @Param("maxReadyInMinutes") Integer maxReadyInMinutes,
            @Param("vegetarian") Boolean vegetarian,
            @Param("vegan") Boolean vegan,
            @Param("category") String category
    );

    Optional<Recipe> findBySpoonacularId(Long spoonacularId);

    @Query("select r from Recipe r where r.titleTr is null")
    Page<Recipe> findAllWithoutTurkishTitle(Pageable pageable);

    @Query("select r.id from Recipe r")
    List<Long> findAllIds();

    @Query("""
            select r from Recipe r
            left join fetch r.recipeNutrition
            left join fetch r.recipeIngredients ri
            left join fetch ri.ingredient
            where r.id = :id
            """)
    Optional<Recipe> findByIdWithIngredientsAndNutrition(@Param("id") Long id);

    @Query("""
            select r from Recipe r
            left join fetch r.recipeTags
            where r.id = :id
            """)
    Optional<Recipe> findByIdWithTags(@Param("id") Long id);

    @Query("""
            select r from Recipe r
            left join fetch r.recipeSteps
            where r.id = :id
            """)
    Optional<Recipe> findByIdWithSteps(@Param("id") Long id);
}
