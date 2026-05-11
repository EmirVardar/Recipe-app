package com.student.recipe.service;

import com.student.recipe.entity.FoodProduct;
import com.student.recipe.entity.Ingredient;
import com.student.recipe.entity.Recipe;
import com.student.recipe.entity.RecipeStep;
import com.student.recipe.repository.FoodProductRepository;
import com.student.recipe.repository.IngredientRepository;
import com.student.recipe.repository.RecipeRepository;
import com.student.recipe.repository.RecipeStepRepository;
import com.student.recipe.repository.RecipeTagRepository;
import com.student.recipe.service.assistant.OpenAiService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class TranslationService {

    private static final Logger log = LoggerFactory.getLogger(TranslationService.class);
    private static final int BATCH_SIZE = 20;
    private static final long DELAY_MS = 500;

    private static final String TRANSLATION_SYSTEM_PROMPT = """
            You are a food name translator specialized in FNDDS (US food database) product names.
            Translate the given food product name to Turkish.
            
            Rules:
            - Return ONLY the Turkish name, nothing else
            - Do not add explanations or punctuation at the end
            - Use natural, everyday Turkish that a user would search for
            - Do not use comma-separated format
            - Keep cultural dish names but translate the meat/main ingredient (e.g. "Veal Marsala" → "Dana Marsala")
            - Skip technical suffixes like "NS as to fat eaten", "Puerto Rican style" → just translate the core food
            - If untranslatable, return the original English name
            """;

    private static final String INGREDIENT_TRANSLATION_SYSTEM_PROMPT = """
            You are a food ingredient translator.
            Translate the given ingredient name to Turkish.
            
            Rules:
            - Return ONLY the Turkish name, nothing else
            - Do not add explanations or punctuation at the end
            - Use natural, everyday Turkish that a user would search for
            - Do not use comma-separated format
            - If untranslatable, return the original English name
            """;

    private static final String RECIPE_TITLE_TRANSLATION_SYSTEM_PROMPT = """
            You are a recipe title translator.
            Translate the given recipe title to Turkish.

            Rules:
            - Return ONLY the Turkish title, nothing else
            - Do not add explanations or punctuation at the end
            - Use natural, everyday Turkish that a user would understand in a recipe app
            - Keep well-known dish names when natural, but translate core ingredients and style where appropriate
            - If untranslatable, return the original English title
            """;

    private static final String RECIPE_STEP_TRANSLATION_SYSTEM_PROMPT = """
            You are a cooking instruction translator.
            Translate the given recipe step to Turkish.

            Rules:
            - Return ONLY the Turkish instruction, nothing else
            - Do not add explanations or extra formatting
            - Preserve the original cooking meaning and sequence
            - Use natural Turkish suitable for a recipe app
            - Keep measurements, temperatures, and timing accurate
            - If untranslatable, return the original English instruction
            """;

    private static final String RECIPE_TAG_TRANSLATION_SYSTEM_PROMPT = """
            You are a recipe taxonomy translator.
            Translate the given recipe tag value to Turkish.

            Rules:
            - Return ONLY the Turkish tag, nothing else
            - Do not add explanations or punctuation
            - Use short, natural Turkish labels suitable for app filters and badges
            - Keep the meaning broad and category-friendly
            - If untranslatable, return the original English tag
            """;

    private final AtomicBoolean isFoodRunning = new AtomicBoolean(false);
    private final AtomicBoolean isIngredientRunning = new AtomicBoolean(false);
    private final AtomicBoolean isRecipeTitleRunning = new AtomicBoolean(false);
    private final AtomicBoolean isRecipeStepRunning = new AtomicBoolean(false);
    private final AtomicBoolean isRecipeTagRunning = new AtomicBoolean(false);

    private volatile int foodTranslated = 0;
    private volatile int foodFailed = 0;
    private volatile int ingredientTranslated = 0;
    private volatile int ingredientFailed = 0;
    private volatile int recipeTitleTranslated = 0;
    private volatile int recipeTitleFailed = 0;
    private volatile int recipeStepTranslated = 0;
    private volatile int recipeStepFailed = 0;
    private volatile int recipeTagTranslated = 0;
    private volatile int recipeTagFailed = 0;

    private final FoodProductRepository foodProductRepository;
    private final IngredientRepository ingredientRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeStepRepository recipeStepRepository;
    private final RecipeTagRepository recipeTagRepository;
    private final OpenAiService openAiService;

    public TranslationService(
            FoodProductRepository foodProductRepository,
            IngredientRepository ingredientRepository,
            RecipeRepository recipeRepository,
            RecipeStepRepository recipeStepRepository,
            RecipeTagRepository recipeTagRepository,
            OpenAiService openAiService
    ) {
        this.foodProductRepository = foodProductRepository;
        this.ingredientRepository = ingredientRepository;
        this.recipeRepository = recipeRepository;
        this.recipeStepRepository = recipeStepRepository;
        this.recipeTagRepository = recipeTagRepository;
        this.openAiService = openAiService;
    }

    // ── FOOD PRODUCT ────────────────────────────────────────────────

    @Async
    public void translateFoodProducts() {
        if (!isFoodRunning.compareAndSet(false, true)) {
            log.warn("Food product translation job already running, skipping");
            return;
        }

        foodTranslated = 0;
        foodFailed = 0;

        try {
            int page = 0;
            log.info("Food product translation job started");

            while (true) {
                Page<FoodProduct> batch = foodProductRepository
                        .findAllWithoutTurkishName(PageRequest.of(page, BATCH_SIZE));

                if (batch.isEmpty()) break;

                log.info("Food batch {}/{} ({} items)",
                        page + 1, batch.getTotalPages(), batch.getContent().size());

                List<FoodProduct> toSave = new ArrayList<>();

                for (FoodProduct product : batch.getContent()) {
                    try {
                        String nameTr = translate(product.getName(), TRANSLATION_SYSTEM_PROMPT);
                        product.setNameTr(nameTr);
                        toSave.add(product);
                        log.debug("Translated food: {} → {}", product.getName(), nameTr);
                    } catch (Exception e) {
                        log.warn("Food translation failed: {} | {}", product.getName(), e.getMessage());
                        foodFailed++;
                    }
                }

                foodProductRepository.saveAll(toSave);
                foodTranslated += toSave.size();

                if (batch.isLast()) break;

                sleep();
                page++;
            }

            log.info("Food translation finished. Translated: {}, Failed: {}", foodTranslated, foodFailed);

        } finally {
            isFoodRunning.set(false);
        }
    }

    // ── INGREDIENT ──────────────────────────────────────────────────

    @Async
    public void translateIngredients() {
        if (!isIngredientRunning.compareAndSet(false, true)) {
            log.warn("Ingredient translation job already running, skipping");
            return;
        }

        ingredientTranslated = 0;
        ingredientFailed = 0;

        try {
            int page = 0;
            log.info("Ingredient translation job started");

            while (true) {
                Page<Ingredient> batch = ingredientRepository
                        .findAllWithoutTurkishName(PageRequest.of(page, BATCH_SIZE));

                if (batch.isEmpty()) break;

                log.info("Ingredient batch {}/{} ({} items)",
                        page + 1, batch.getTotalPages(), batch.getContent().size());

                List<Ingredient> toSave = new ArrayList<>();

                for (Ingredient ingredient : batch.getContent()) {
                    try {
                        String nameTr = translate(ingredient.getName(), INGREDIENT_TRANSLATION_SYSTEM_PROMPT);
                        ingredient.setNameTr(nameTr);
                        toSave.add(ingredient);
                        log.debug("Translated ingredient: {} → {}", ingredient.getName(), nameTr);
                    } catch (Exception e) {
                        log.warn("Ingredient translation failed: {} | {}", ingredient.getName(), e.getMessage());
                        ingredientFailed++;
                    }
                }

                ingredientRepository.saveAll(toSave);
                ingredientTranslated += toSave.size();

                if (batch.isLast()) break;

                sleep();
                page++;
            }

            log.info("Ingredient translation finished. Translated: {}, Failed: {}", ingredientTranslated, ingredientFailed);

        } finally {
            isIngredientRunning.set(false);
        }
    }

    // ── RECIPE TITLE ────────────────────────────────────────────────

    @Async
    public void translateRecipeTitles() {
        if (!isRecipeTitleRunning.compareAndSet(false, true)) {
            log.warn("Recipe title translation job already running, skipping");
            return;
        }

        recipeTitleTranslated = 0;
        recipeTitleFailed = 0;

        try {
            int page = 0;
            log.info("Recipe title translation job started");

            while (true) {
                Page<Recipe> batch = recipeRepository
                        .findAllWithoutTurkishTitle(PageRequest.of(page, BATCH_SIZE));

                if (batch.isEmpty()) break;

                log.info("Recipe title batch {}/{} ({} items)",
                        page + 1, batch.getTotalPages(), batch.getContent().size());

                List<Recipe> toSave = new ArrayList<>();

                for (Recipe recipe : batch.getContent()) {
                    try {
                        String titleTr = translate(recipe.getTitle(), RECIPE_TITLE_TRANSLATION_SYSTEM_PROMPT);
                        recipe.setTitleTr(titleTr);
                        toSave.add(recipe);
                        log.debug("Translated recipe title: {} → {}", recipe.getTitle(), titleTr);
                    } catch (Exception e) {
                        log.warn("Recipe title translation failed: {} | {}", recipe.getTitle(), e.getMessage());
                        recipeTitleFailed++;
                    }
                }

                recipeRepository.saveAll(toSave);
                recipeTitleTranslated += toSave.size();

                if (batch.isLast()) break;

                sleep();
                page++;
            }

            log.info("Recipe title translation finished. Translated: {}, Failed: {}",
                    recipeTitleTranslated, recipeTitleFailed);

        } finally {
            isRecipeTitleRunning.set(false);
        }
    }

    // ── RECIPE STEP ─────────────────────────────────────────────────

    @Async
    public void translateRecipeSteps() {
        if (!isRecipeStepRunning.compareAndSet(false, true)) {
            log.warn("Recipe step translation job already running, skipping");
            return;
        }

        recipeStepTranslated = 0;
        recipeStepFailed = 0;

        try {
            int page = 0;
            log.info("Recipe step translation job started");

            while (true) {
                Page<RecipeStep> batch = recipeStepRepository
                        .findAllWithoutTurkishInstruction(PageRequest.of(page, BATCH_SIZE));

                if (batch.isEmpty()) break;

                log.info("Recipe step batch {}/{} ({} items)",
                        page + 1, batch.getTotalPages(), batch.getContent().size());

                List<RecipeStep> toSave = new ArrayList<>();

                for (RecipeStep recipeStep : batch.getContent()) {
                    try {
                        String instructionTr = translate(
                                recipeStep.getInstruction(),
                                RECIPE_STEP_TRANSLATION_SYSTEM_PROMPT
                        );
                        recipeStep.setInstructionTr(instructionTr);
                        toSave.add(recipeStep);
                        log.debug("Translated recipe step {} → {}", recipeStep.getId(), instructionTr);
                    } catch (Exception e) {
                        log.warn("Recipe step translation failed: id={} | {}", recipeStep.getId(), e.getMessage());
                        recipeStepFailed++;
                    }
                }

                recipeStepRepository.saveAll(toSave);
                recipeStepTranslated += toSave.size();

                if (batch.isLast()) break;

                sleep();
                page++;
            }

            log.info("Recipe step translation finished. Translated: {}, Failed: {}",
                    recipeStepTranslated, recipeStepFailed);

        } finally {
            isRecipeStepRunning.set(false);
        }
    }

    // ── RECIPE TAG ──────────────────────────────────────────────────

    @Async
    @Transactional
    public void translateRecipeTags() {
        if (!isRecipeTagRunning.compareAndSet(false, true)) {
            log.warn("Recipe tag translation job already running, skipping");
            return;
        }

        recipeTagTranslated = 0;
        recipeTagFailed = 0;

        try {
            List<String> distinctTagValues = recipeTagRepository.findDistinctUntranslatedTagValues();
            log.info("Recipe tag translation job started ({} distinct values)", distinctTagValues.size());

            for (String tagValue : distinctTagValues) {
                try {
                    String tagValueTr = translate(tagValue, RECIPE_TAG_TRANSLATION_SYSTEM_PROMPT);
                    int updatedCount = recipeTagRepository.updateTagValueTrByTagValue(tagValue, tagValueTr);
                    recipeTagTranslated++;
                    log.debug("Translated recipe tag: {} → {} ({} rows)", tagValue, tagValueTr, updatedCount);
                    sleep();
                } catch (Exception e) {
                    recipeTagFailed++;
                    log.warn("Recipe tag translation failed: {} | {}", tagValue, e.getMessage());
                }
            }

            log.info("Recipe tag translation finished. Distinct translated: {}, Failed: {}",
                    recipeTagTranslated, recipeTagFailed);

        } finally {
            isRecipeTagRunning.set(false);
        }
    }

    // ── STATUS ──────────────────────────────────────────────────────

    public JobStatus getFoodStatus() {
        return new JobStatus(isFoodRunning.get(), foodTranslated, foodFailed);
    }

    public JobStatus getIngredientStatus() {
        return new JobStatus(isIngredientRunning.get(), ingredientTranslated, ingredientFailed);
    }

    public JobStatus getRecipeTitleStatus() {
        return new JobStatus(isRecipeTitleRunning.get(), recipeTitleTranslated, recipeTitleFailed);
    }

    public JobStatus getRecipeStepStatus() {
        return new JobStatus(isRecipeStepRunning.get(), recipeStepTranslated, recipeStepFailed);
    }

    public JobStatus getRecipeTagStatus() {
        return new JobStatus(isRecipeTagRunning.get(), recipeTagTranslated, recipeTagFailed);
    }

    // ── HELPERS ─────────────────────────────────────────────────────

    private String translate(String englishName, String systemPrompt) {
        String userPrompt = "Translate this food name to Turkish: \"" + englishName + "\"";
        return openAiService.chat(systemPrompt, userPrompt).trim();
    }

    private void sleep() {
        try {
            Thread.sleep(DELAY_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Translation job interrupted");
        }
    }

    public record JobStatus(boolean running, int translated, int failed) {}
}
