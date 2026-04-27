package com.student.recipe.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import com.student.recipe.dto.meal.*;
import com.student.recipe.entity.*;
import com.student.recipe.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.entity.enums.MealType;
import com.student.recipe.entity.enums.MealUnitType;

@Service
public class MealTrackingService {

    private final UserRepository userRepository;
    private final FoodProductRepository foodProductRepository;
    private final MealLogRepository mealLogRepository;
    private final MealLogItemRepository mealLogItemRepository;
    private final RecipeRepository recipeRepository;

    public MealTrackingService(
            UserRepository userRepository,
            FoodProductRepository foodProductRepository,
            MealLogRepository mealLogRepository,
            MealLogItemRepository mealLogItemRepository,
            RecipeRepository recipeRepository
    ) {
        this.userRepository = userRepository;
        this.foodProductRepository = foodProductRepository;
        this.mealLogRepository = mealLogRepository;
        this.mealLogItemRepository = mealLogItemRepository;
        this.recipeRepository = recipeRepository;
    }

    @Transactional
    public MealLogItemResponseDto addMealItem(String email, MealLogItemCreateRequestDto request) {
        validateRequest(request);

        User user = getUserByEmail(email);
        FoodProduct foodProduct = foodProductRepository.findById(request.foodProductId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food product not found"));

        MealType mealType = parseMealType(request.mealType());
        MealUnitType unitType = parseUnitType(request.unitType());
        LocalDate logDate = request.logDate() == null ? LocalDate.now() : request.logDate();

        MealLog mealLog = mealLogRepository.findByUserIdAndLogDateAndMealType(user.getId(), logDate, mealType)
                .orElseGet(() -> createMealLog(user, logDate, mealType));

        double gramEquivalent = calculateGramEquivalent(foodProduct, request.quantity(), unitType);
        MealLogItem item = new MealLogItem();
        item.setMealLog(mealLog);
        item.setFoodProduct(foodProduct);
        item.setQuantity(request.quantity());
        item.setUnitType(unitType);
        item.setGramEquivalent(gramEquivalent);
        item.setCalories(calculateMacro(gramEquivalent, foodProduct.getCaloriesPer100g()));
        item.setProtein(calculateMacro(gramEquivalent, foodProduct.getProteinPer100g()));
        item.setCarbs(calculateMacro(gramEquivalent, foodProduct.getCarbsPer100g()));
        item.setFat(calculateMacro(gramEquivalent, foodProduct.getFatPer100g()));

        MealLogItem saved = mealLogItemRepository.save(item);
        return toItemDto(saved);
    }

    @Transactional
    public MealLogItemResponseDto updateMealItem(String email, Long itemId, MealLogItemCreateRequestDto request) {
        validateRequest(request);

        User user = getUserByEmail(email);
        MealLogItem item = getOwnedMealItem(user.getId(), itemId);
        MealLog previousMealLog = item.getMealLog();

        FoodProduct foodProduct = foodProductRepository.findById(request.foodProductId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food product not found"));

        MealType mealType = parseMealType(request.mealType());
        MealUnitType unitType = parseUnitType(request.unitType());
        LocalDate logDate = request.logDate() == null ? LocalDate.now() : request.logDate();

        MealLog targetMealLog = mealLogRepository.findByUserIdAndLogDateAndMealType(user.getId(), logDate, mealType)
                .orElseGet(() -> createMealLog(user, logDate, mealType));

        double gramEquivalent = calculateGramEquivalent(foodProduct, request.quantity(), unitType);
        item.setMealLog(targetMealLog);
        item.setRecipe(null);
        item.setFoodProduct(foodProduct);
        item.setQuantity(request.quantity());
        item.setUnitType(unitType);
        item.setGramEquivalent(gramEquivalent);
        item.setCalories(calculateMacro(gramEquivalent, foodProduct.getCaloriesPer100g()));
        item.setProtein(calculateMacro(gramEquivalent, foodProduct.getProteinPer100g()));
        item.setCarbs(calculateMacro(gramEquivalent, foodProduct.getCarbsPer100g()));
        item.setFat(calculateMacro(gramEquivalent, foodProduct.getFatPer100g()));

        MealLogItem saved = mealLogItemRepository.save(item);
        cleanupMealLogIfEmpty(previousMealLog);
        return toItemDto(saved);
    }

    @Transactional
    public void deleteMealItem(String email, Long itemId) {
        User user = getUserByEmail(email);
        MealLogItem item = getOwnedMealItem(user.getId(), itemId);
        MealLog mealLog = item.getMealLog();
        mealLogItemRepository.delete(item);
        cleanupMealLogIfEmpty(mealLog);
    }

    @Transactional(readOnly = true)
    public DailyMealLogsResponseDto getDailyMeals(String email, LocalDate logDate) {
        User user = getUserByEmail(email);
        LocalDate targetDate = logDate == null ? LocalDate.now() : logDate;

        List<MealLogResponseDto> meals = mealLogRepository.findAllByUserIdAndLogDateOrderByCreatedAtAsc(user.getId(), targetDate)
                .stream()
                .sorted(Comparator.comparingInt(log -> mealOrder(log.getMealType())))
                .map(this::toMealDto)
                .toList();

        return new DailyMealLogsResponseDto(
                targetDate,
                sumMealValue(meals, MealLogResponseDto::totalCalories),
                sumMealValue(meals, MealLogResponseDto::totalProtein),
                sumMealValue(meals, MealLogResponseDto::totalCarbs),
                sumMealValue(meals, MealLogResponseDto::totalFat),
                meals
        );
    }

    private MealLog createMealLog(User user, LocalDate logDate, MealType mealType) {
        MealLog mealLog = new MealLog();
        mealLog.setUser(user);
        mealLog.setLogDate(logDate);
        mealLog.setMealType(mealType);
        return mealLogRepository.save(mealLog);
    }

    private void cleanupMealLogIfEmpty(MealLog mealLog) {
        if (mealLog == null || mealLog.getId() == null) {
            return;
        }

        if (mealLogItemRepository.countByMealLogId(mealLog.getId()) == 0) {
            mealLogRepository.delete(mealLog);
        }
    }

    private MealLogResponseDto toMealDto(MealLog mealLog) {
        List<MealLogItemResponseDto> items = mealLog.getItems().stream()
                .map(this::toItemDto)
                .toList();

        return new MealLogResponseDto(
                mealLog.getId(),
                mealLog.getMealType().name(),
                sumItemValue(items, MealLogItemResponseDto::calories),
                sumItemValue(items, MealLogItemResponseDto::protein),
                sumItemValue(items, MealLogItemResponseDto::carbs),
                sumItemValue(items, MealLogItemResponseDto::fat),
                items
        );
    }

    private MealLogItemResponseDto toItemDto(MealLogItem item) {
        Long sourceId;
        String sourceName;
        String sourceType;

        if (item.getRecipe() != null) {
            sourceId = item.getRecipe().getId();
            sourceName = item.getRecipe().getTitle();
            sourceType = "RECIPE";
        } else if (item.getFoodProduct() != null) {
            sourceId = item.getFoodProduct().getId();
            sourceName = item.getFoodProduct().getName();
            sourceType = "FOOD";
        } else {
            sourceId = null;
            sourceName = null;
            sourceType = "UNKNOWN";
        }

        return new MealLogItemResponseDto(
                item.getId(),
                sourceId,
                sourceName,
                sourceType,
                item.getQuantity(),
                item.getUnitType().name(),
                item.getGramEquivalent(),
                item.getCalories(),
                item.getProtein(),
                item.getCarbs(),
                item.getFat()
        );
    }

    private double calculateGramEquivalent(FoodProduct foodProduct, double quantity, MealUnitType unitType) {
        if (unitType == MealUnitType.GRAM) {
            return quantity;
        }

        double basePieceWeight = foodProduct.getPieceGramWeight() != null
                ? foodProduct.getPieceGramWeight()
                : foodProduct.getDefaultGramWeight();

        if (basePieceWeight <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu urun icin adet gram bilgisi yok");
        }

        return quantity * basePieceWeight;
    }

    private double calculateMacro(double gramEquivalent, Double per100gValue) {
        if (per100gValue == null) {
            return 0.0;
        }

        return (gramEquivalent / 100.0) * per100gValue;
    }

    private double sumItemValue(List<MealLogItemResponseDto> items, java.util.function.Function<MealLogItemResponseDto, Double> extractor) {
        return items.stream()
                .map(extractor)
                .filter(value -> value != null)
                .mapToDouble(Double::doubleValue)
                .sum();
    }

    private double sumMealValue(List<MealLogResponseDto> meals, java.util.function.Function<MealLogResponseDto, Double> extractor) {
        return meals.stream()
                .map(extractor)
                .filter(value -> value != null)
                .mapToDouble(Double::doubleValue)
                .sum();
    }

    private int mealOrder(MealType mealType) {
        return switch (mealType) {
            case BREAKFAST -> 1;
            case LUNCH -> 2;
            case DINNER -> 3;
            case SNACK -> 4;
        };
    }

    private MealType parseMealType(String raw) {
        try {
            return MealType.valueOf(normalizeEnumToken(raw));
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mealType gecersiz");
        }
    }

    private MealUnitType parseUnitType(String raw) {
        try {
            return MealUnitType.valueOf(normalizeEnumToken(raw));
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unitType gecersiz");
        }
    }

    private String normalizeEnumToken(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Zorunlu alan bos");
        }

        return raw.trim()
                .replace('-', '_')
                .replace(' ', '_')
                .toUpperCase(Locale.ROOT);
    }

    private void validateRequest(MealLogItemCreateRequestDto request) {
        if (request.foodProductId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "foodProductId zorunlu");
        }
        if (request.quantity() == null || request.quantity() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "quantity 0'dan buyuk olmali");
        }
        if (request.mealType() == null || request.mealType().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mealType zorunlu");
        }
        if (request.unitType() == null || request.unitType().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unitType zorunlu");
        }
    }

    private MealLogItem getOwnedMealItem(Long userId, Long itemId) {
        MealLogItem item = mealLogItemRepository.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal item not found"));

        if (!item.getMealLog().getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu meal item baska bir kullaniciya ait");
        }

        return item;
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    @Transactional
    public MealLogItemResponseDto addRecipeMealItem(String email, RecipeMealLogItemCreateRequestDto request) {
        validateRecipeRequest(request);

        User user = getUserByEmail(email);
        MealType mealType = parseMealType(request.mealType());
        LocalDate logDate = request.logDate() == null ? LocalDate.now() : request.logDate();

        MealLog mealLog = mealLogRepository.findByUserIdAndLogDateAndMealType(user.getId(), logDate, mealType)
                .orElseGet(() -> createMealLog(user, logDate, mealType));

        MealLogItem item = new MealLogItem();
        applyRecipeItem(item, request, mealLog);

        MealLogItem saved = mealLogItemRepository.save(item);
        return toItemDto(saved);
    }

    @Transactional
    public MealLogItemResponseDto updateRecipeMealItem(String email, Long itemId, RecipeMealLogItemCreateRequestDto request) {
        validateRecipeRequest(request);

        User user = getUserByEmail(email);
        MealLogItem item = getOwnedMealItem(user.getId(), itemId);
        MealLog previousMealLog = item.getMealLog();

        MealType mealType = parseMealType(request.mealType());
        LocalDate logDate = request.logDate() == null ? LocalDate.now() : request.logDate();

        MealLog targetMealLog = mealLogRepository.findByUserIdAndLogDateAndMealType(user.getId(), logDate, mealType)
                .orElseGet(() -> createMealLog(user, logDate, mealType));

        applyRecipeItem(item, request, targetMealLog);

        MealLogItem saved = mealLogItemRepository.save(item);
        cleanupMealLogIfEmpty(previousMealLog);
        return toItemDto(saved);
    }

    private void applyRecipeItem(MealLogItem item, RecipeMealLogItemCreateRequestDto request, MealLog mealLog) {
        Recipe recipe = recipeRepository.findById(request.recipeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found"));

        RecipeNutrition nutrition = recipe.getRecipeNutrition();
        if (nutrition == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipe has no nutrition information");
        }

        item.setMealLog(mealLog);
        item.setRecipe(recipe);
        item.setFoodProduct(null);
        item.setQuantity(request.servings());
        item.setUnitType(MealUnitType.SERVING);
        item.setGramEquivalent(0.0);
        item.setCalories(orZero(nutrition.getCalories()) * request.servings());
        item.setProtein(orZero(nutrition.getProtein()) * request.servings());
        item.setCarbs(orZero(nutrition.getCarbs()) * request.servings());
        item.setFat(orZero(nutrition.getFat()) * request.servings());
    }

    private double orZero(Double value) {
        return value != null ? value : 0.0;
    }

    private void validateRecipeRequest(RecipeMealLogItemCreateRequestDto request) {
        if (request.recipeId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "recipeId is required");
        }
        if (request.servings() == null || request.servings() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "servings must be greater than 0");
        }
        if (request.mealType() == null || request.mealType().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mealType is required");
        }
    }
}
