package com.student.recipe.service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.entity.Recipe;
import com.student.recipe.entity.User;
import com.student.recipe.entity.UserFavoriteRecipe;
import com.student.recipe.repository.RecipeRepository;
import com.student.recipe.repository.UserFavoriteRecipeRepository;
import com.student.recipe.repository.UserRepository;

@Service
public class RecipeFavoriteService {

    private final UserRepository userRepository;
    private final RecipeRepository recipeRepository;
    private final UserFavoriteRecipeRepository userFavoriteRecipeRepository;

    public RecipeFavoriteService(
            UserRepository userRepository,
            RecipeRepository recipeRepository,
            UserFavoriteRecipeRepository userFavoriteRecipeRepository
    ) {
        this.userRepository = userRepository;
        this.recipeRepository = recipeRepository;
        this.userFavoriteRecipeRepository = userFavoriteRecipeRepository;
    }

    @Transactional(readOnly = true)
    public Set<Long> getFavoriteRecipeIds(String email) {
        User user = getUserByEmail(email);

        return userFavoriteRecipeRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(favorite -> favorite.getRecipe().getId())
                .collect(Collectors.toSet());
    }

    @Transactional(readOnly = true)
    public List<Recipe> getFavoriteRecipes(String email) {
        User user = getUserByEmail(email);

        return userFavoriteRecipeRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(UserFavoriteRecipe::getRecipe)
                .toList();
    }

    @Transactional
    public void addFavorite(String email, Long recipeId) {
        User user = getUserByEmail(email);
        Recipe recipe = recipeRepository.findById(recipeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found"));

        if (userFavoriteRecipeRepository.existsByUserIdAndRecipeId(user.getId(), recipeId)) {
            return;
        }

        UserFavoriteRecipe favorite = new UserFavoriteRecipe();
        favorite.setUser(user);
        favorite.setRecipe(recipe);
        userFavoriteRecipeRepository.save(favorite);
    }

    @Transactional
    public void removeFavorite(String email, Long recipeId) {
        User user = getUserByEmail(email);

        userFavoriteRecipeRepository.findByUserIdAndRecipeId(user.getId(), recipeId)
                .ifPresent(userFavoriteRecipeRepository::delete);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
