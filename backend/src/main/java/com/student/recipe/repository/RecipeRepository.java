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

    @Query(value = """
            select sub.id
            from (
                select distinct r.id,
                    case
                        when :query is null or :query = ''                         then 0
                        when coalesce(r.title_tr,'') ilike :query                 then 1
                        when r.title                  ilike :query                 then 1
                        when coalesce(r.title_tr,'') ilike concat(:query,'%')     then 2
                        when r.title                  ilike concat(:query,'%')     then 2
                        when coalesce(r.title_tr,'') ilike concat('%',:query,'%') then 3
                        when r.title                  ilike concat('%',:query,'%') then 3
                        else 4
                    end as sort_priority,
                    greatest(
                        similarity(r.title, :query),
                        similarity(coalesce(r.title_tr,''), :query)
                    ) as sim_score,
                    r.very_popular,
                    r.health_score
                from recipes r
                left join recipe_nutrition rn on rn.recipe_id = r.id
                left join recipe_ingredients ri on ri.recipe_id = r.id
                left join ingredients i on i.id = ri.ingredient_id
                where (
                        :query is null or :query = ''
                        or r.title ilike concat('%', :query, '%')
                        or coalesce(r.title_tr, '') ilike concat('%', :query, '%')
                        or i.name ilike concat('%', :query, '%')
                        or coalesce(i.name_tr, '') ilike concat('%', :query, '%')
                        or r.title % :query
                        or coalesce(r.title_tr, '') % :query
                      )
                  and (:minCalories is null or rn.calories >= cast(:minCalories as double precision))
                  and (:maxCalories is null or rn.calories <= cast(:maxCalories as double precision))
                  and (:highProtein = false or rn.protein >= cast(:proteinThreshold as double precision))
                  and (:maxReadyInMinutes is null or r.ready_in_minutes <= cast(:maxReadyInMinutes as int))
                  and (:vegetarian is null or r.vegetarian = :vegetarian)
                  and (:vegan is null or r.vegan = :vegan)
                  and (
                        :category is null or :category = ''
                        or (
                            :category = 'main'
                            and not exists (
                                select 1 from recipe_tags rt2
                                where rt2.recipe_id = r.id
                                  and rt2.tag_type = 'dish_type'
                                  and lower(rt2.tag_value) in ('dessert','salad','soup','breakfast','drink','snack','lunch','dinner')
                            )
                        )
                        or exists (
                            select 1 from recipe_tags rt3
                            where rt3.recipe_id = r.id
                              and rt3.tag_type = 'dish_type'
                              and rt3.tag_value ilike :category
                        )
                      )
            ) sub
            order by sub.sort_priority asc, sub.sim_score desc, sub.very_popular desc, sub.health_score desc
            limit 50
            """, nativeQuery = true)
    List<Long> searchRecipeIds(
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
