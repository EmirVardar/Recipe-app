package com.student.recipe.service;

import java.time.LocalDate;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.student.recipe.dto.user.MedicalResponseDto;
import com.student.recipe.dto.user.MedicalUpdateRequestDto;
import com.student.recipe.dto.user.NutritionPreferenceResponseDto;
import com.student.recipe.dto.user.NutritionPreferenceUpdateRequestDto;
import com.student.recipe.dto.user.OnboardingStatusResponseDto;
import com.student.recipe.dto.user.ProfileResponseDto;
import com.student.recipe.dto.user.ProfileUpdateRequestDto;
import com.student.recipe.entity.User;
import com.student.recipe.entity.UserMedical;
import com.student.recipe.entity.UserNutritionPreference;
import com.student.recipe.entity.UserProfile;
import com.student.recipe.entity.enums.ActivityLevel;
import com.student.recipe.entity.enums.BudgetLevel;
import com.student.recipe.entity.enums.DietType;
import com.student.recipe.entity.enums.GoalType;
import com.student.recipe.entity.enums.SexType;
import com.student.recipe.repository.UserMedicalRepository;
import com.student.recipe.repository.UserNutritionPreferenceRepository;
import com.student.recipe.repository.UserProfileRepository;
import com.student.recipe.repository.UserRepository;

@Service
public class UserHealthService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final UserMedicalRepository userMedicalRepository;
    private final UserNutritionPreferenceRepository userNutritionPreferenceRepository;

    public UserHealthService(
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            UserMedicalRepository userMedicalRepository,
            UserNutritionPreferenceRepository userNutritionPreferenceRepository
    ) {
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.userMedicalRepository = userMedicalRepository;
        this.userNutritionPreferenceRepository = userNutritionPreferenceRepository;
    }

    public OnboardingStatusResponseDto getOnboardingStatus(String email) {
        User user = getUserByEmail(email);

        boolean profileCompleted = userProfileRepository.findByUserId(user.getId())
                .map(this::isProfileComplete)
                .orElse(false);

        boolean medicalCompleted = userMedicalRepository.findByUserId(user.getId())
                .map(this::isMedicalComplete)
                .orElse(false);

        boolean nutritionCompleted = userNutritionPreferenceRepository.findByUserId(user.getId())
                .map(this::isNutritionComplete)
                .orElse(false);

        return new OnboardingStatusResponseDto(
                profileCompleted,
                medicalCompleted,
                nutritionCompleted,
                profileCompleted && medicalCompleted && nutritionCompleted
        );
    }

    public ProfileResponseDto getProfile(String email) {
        User user = getUserByEmail(email);

        return userProfileRepository.findByUserId(user.getId())
                .map(profile -> new ProfileResponseDto(
                        profile.getBirthDate(),
                        profile.getSex(),
                        profile.getHeightCm(),
                        profile.getWeightKg(),
                        profile.getActivityLevel(),
                        profile.getGoal()
                ))
                .orElse(new ProfileResponseDto(null, null, null, null, null, null));
    }

    public MedicalResponseDto getMedical(String email) {
        User user = getUserByEmail(email);

        return userMedicalRepository.findByUserId(user.getId())
                .map(medical -> new MedicalResponseDto(
                        medical.getChronicConditions(),
                        medical.getMedications(),
                        medical.getAllergies(),
                        medical.getIntolerances()
                ))
                .orElse(new MedicalResponseDto(null, null, null, null));
    }

    public NutritionPreferenceResponseDto getNutrition(String email) {
        User user = getUserByEmail(email);

        return userNutritionPreferenceRepository.findByUserId(user.getId())
                .map(nutrition -> new NutritionPreferenceResponseDto(
                        nutrition.getDietType(),
                        nutrition.getAvoidFoods(),
                        nutrition.getPreferredFoods(),
                        nutrition.getBudgetLevel()
                ))
                .orElse(new NutritionPreferenceResponseDto(null, null, null, null));
    }

    public ProfileResponseDto upsertProfile(String email, ProfileUpdateRequestDto request) {
        User user = getUserByEmail(email);
        validateProfileRequest(request);

        SexType sex = parseRequiredEnum(request.sex(), SexType.class, "sex");
        ActivityLevel activityLevel = parseRequiredEnum(request.activityLevel(), ActivityLevel.class, "activityLevel");
        GoalType goal = parseRequiredEnum(request.goal(), GoalType.class, "goal");

        UserProfile profile = userProfileRepository.findByUserId(user.getId()).orElseGet(UserProfile::new);
        profile.setUser(user);
        profile.setBirthDate(request.birthDate());
        profile.setSex(sex.name());
        profile.setHeightCm(request.heightCm());
        profile.setWeightKg(request.weightKg());
        profile.setActivityLevel(activityLevel.name());
        profile.setGoal(goal.name());

        UserProfile saved = userProfileRepository.save(profile);
        user.setProfile(saved);

        return new ProfileResponseDto(
                saved.getBirthDate(),
                saved.getSex(),
                saved.getHeightCm(),
                saved.getWeightKg(),
                saved.getActivityLevel(),
                saved.getGoal()
        );
    }

    public MedicalResponseDto upsertMedical(String email, MedicalUpdateRequestDto request) {
        User user = getUserByEmail(email);
        validateMedicalRequest(request);

        UserMedical medical = userMedicalRepository.findByUserId(user.getId()).orElseGet(UserMedical::new);
        medical.setUser(user);
        medical.setChronicConditions(normalizeNullable(request.chronicConditions()));
        medical.setMedications(normalizeNullable(request.medications()));
        medical.setAllergies(normalizeNullable(request.allergies()));
        medical.setIntolerances(normalizeNullable(request.intolerances()));

        UserMedical saved = userMedicalRepository.save(medical);
        user.setMedical(saved);

        return new MedicalResponseDto(
                saved.getChronicConditions(),
                saved.getMedications(),
                saved.getAllergies(),
                saved.getIntolerances()
        );
    }

    public NutritionPreferenceResponseDto upsertNutrition(String email, NutritionPreferenceUpdateRequestDto request) {
        User user = getUserByEmail(email);
        validateNutritionRequest(request);

        DietType dietType = parseRequiredEnum(request.dietType(), DietType.class, "dietType");
        BudgetLevel budgetLevel = parseRequiredEnum(request.budgetLevel(), BudgetLevel.class, "budgetLevel");

        UserNutritionPreference nutrition = userNutritionPreferenceRepository.findByUserId(user.getId())
                .orElseGet(UserNutritionPreference::new);
        nutrition.setUser(user);
        nutrition.setDietType(dietType.name());
        nutrition.setAvoidFoods(normalizeNullable(request.avoidFoods()));
        nutrition.setPreferredFoods(normalizeNullable(request.preferredFoods()));
        nutrition.setBudgetLevel(budgetLevel.name());

        UserNutritionPreference saved = userNutritionPreferenceRepository.save(nutrition);
        user.setNutritionPreference(saved);

        return new NutritionPreferenceResponseDto(
                saved.getDietType(),
                saved.getAvoidFoods(),
                saved.getPreferredFoods(),
                saved.getBudgetLevel()
        );
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private void validateProfileRequest(ProfileUpdateRequestDto request) {
        if (request.birthDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Birth date is required");
        }
        if (request.birthDate().isAfter(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Birth date cannot be in the future");
        }
        if (request.birthDate().isBefore(LocalDate.now().minusYears(120))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Birth date is too far in the past");
        }
        if (isBlank(request.sex())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sex is required");
        }
        if (isBlank(request.activityLevel())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Activity level is required");
        }
        if (request.heightCm() == null || request.heightCm() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Height must be greater than 0");
        }
        if (request.weightKg() == null || request.weightKg() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Weight must be greater than 0");
        }
        if (isBlank(request.goal())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Goal is required");
        }
    }

    private void validateMedicalRequest(MedicalUpdateRequestDto request) {
        if (isBlank(request.chronicConditions())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "chronicConditions is required (use 'none' if there is no condition)");
        }
    }

    private void validateNutritionRequest(NutritionPreferenceUpdateRequestDto request) {
        if (isBlank(request.dietType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dietType is required");
        }
        if (isBlank(request.budgetLevel())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "budgetLevel is required");
        }
    }

    private boolean isProfileComplete(UserProfile profile) {
        return profile.getBirthDate() != null
                && !isBlank(profile.getSex())
                && profile.getHeightCm() != null
                && profile.getHeightCm() > 0
                && profile.getWeightKg() != null
                && profile.getWeightKg() > 0
                && !isBlank(profile.getActivityLevel())
                && !isBlank(profile.getGoal());
    }

    private boolean isMedicalComplete(UserMedical medical) {
        return !isBlank(medical.getChronicConditions());
    }

    private boolean isNutritionComplete(UserNutritionPreference nutritionPreference) {
        return !isBlank(nutritionPreference.getDietType()) && !isBlank(nutritionPreference.getBudgetLevel());
    }

    private <T extends Enum<T>> T parseRequiredEnum(String raw, Class<T> enumClass, String fieldName) {
        if (isBlank(raw)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " is required");
        }

        String normalized = normalizeEnumToken(raw);
        try {
            return Enum.valueOf(enumClass, normalized);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " has invalid value: " + raw);
        }
    }

    private String normalizeEnumToken(String raw) {
        String normalized = raw.trim()
                .replace('ı', 'i')
                .replace('İ', 'I')
                .replace('ş', 's')
                .replace('Ş', 'S')
                .replace('ğ', 'g')
                .replace('Ğ', 'G')
                .replace('ü', 'u')
                .replace('Ü', 'U')
                .replace('ö', 'o')
                .replace('Ö', 'O')
                .replace('ç', 'c')
                .replace('Ç', 'C')
                .replace('-', '_')
                .replace(' ', '_');
        return normalized.toUpperCase();
    }

    private String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
