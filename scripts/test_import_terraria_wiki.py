import unittest

from import_terraria_wiki import (
    build_catalog,
    classify_item,
    parse_alternatives,
    parse_recipe_ingredients,
    supabase_headers,
)


class RecipeParsingTests(unittest.TestCase):
    def test_parse_cargo_ings_format(self):
        ingredients = parse_recipe_ingredients({
            "ings": "¦Luminite¦1^¦Stone Block¦5",
            "args": "",
        })
        self.assertEqual(
            [(row["names"], row["quantity"]) for row in ingredients],
            [(["Luminite"], 1), (["Stone Block"], 5)],
        )

    def test_parse_alternative_ingredient_names(self):
        self.assertEqual(parse_alternatives("Iron/Lead Bar"), ["Iron Bar", "Lead Bar"])
        ingredients = parse_recipe_ingredients({
            "ings": "¦Iron/Lead Bar¦5",
            "args": "",
        })
        self.assertEqual(ingredients[0]["names"], ["Iron Bar", "Lead Bar"])
        self.assertEqual(ingredients[0]["quantity"], 5)


class ItemClassificationTests(unittest.TestCase):
    def test_weapon_classification_and_stable_id(self):
        item = classify_item({
            "itemid": "757",
            "internalname": "TerraBlade",
            "name": "Terra Blade",
            "type": "Weapon",
            "damage": "85",
            "damagetype": "melee",
            "melee": "1",
            "hardmode": "Yes",
        })
        self.assertIsNotNone(item)
        self.assertEqual(item["item_key"], "terraria_757")
        self.assertEqual(item["primary_category"], "weapon")
        self.assertEqual(item["classes"], ["Melee"])
        self.assertEqual(item["stage"], "Hardmode")

    def test_armor_detected_from_type_and_text_slot(self):
        armor = classify_item({
            "itemid": "2277",
            "internalname": "Gi",
            "name": "Gi",
            "type": "Armor",
            "bodySlot": "Shirt",
            "defense": "4",
            "hardmode": "No",
            "melee": "1",
        })
        self.assertIsNotNone(armor)
        self.assertEqual(armor["primary_category"], "armor")
        self.assertEqual(armor["classes"], ["Melee"])

    def test_accessory_detected_from_type_field(self):
        accessory = classify_item({
            "itemid": "554",
            "internalname": "ShieldofCthulhu",
            "name": "Shield of Cthulhu",
            "type": "Accessory",
            "defense": "0",
            "hardmode": "No",
        })
        self.assertIsNotNone(accessory)
        self.assertEqual(accessory["primary_category"], "accessory")
        self.assertEqual(accessory["classes"], ["Melee", "Ranger", "Mage", "Summoner"])

    def test_class_specific_armor_and_accessory(self):
        armor = classify_item({
            "itemid": "7001",
            "name": "Example Mage Hood",
            "type": "Armor",
            "headSlot": "1",
            "bodySlot": "-1",
            "legSlot": "-1",
            "defense": "5",
            "magic": "1",
        })
        self.assertEqual(armor["primary_category"], "armor")
        self.assertEqual(armor["classes"], ["Mage"])

        accessory = classify_item({
            "itemid": "7002",
            "name": "Example Summoner Emblem",
            "type": "Accessory",
            "accessory": "Yes",
            "summon": "1",
        })
        self.assertEqual(accessory["primary_category"], "accessory")
        self.assertEqual(accessory["classes"], ["Summoner"])

    def test_ammo_uses_type_not_weapon_ammo_id(self):
        ammunition = classify_item({
            "itemid": "41",
            "name": "Wooden Arrow",
            "type": "Ammunition/Crafting material",
            "ammo": "0",
            "notAmmo": "No",
        })
        self.assertEqual(ammunition["primary_category"], "ammo")
        self.assertEqual(ammunition["classes"], ["Ranger"])

        gun = classify_item({
            "itemid": "97",
            "name": "Musket",
            "type": "Weapon",
            "damage": "31",
            "damagetype": "ranged",
            "ranged": "1",
            "ammo": "97",
            "notAmmo": "No",
        })
        self.assertEqual(gun["primary_category"], "weapon")


class DependencyGraphTests(unittest.TestCase):
    def test_material_ingredients_are_added_with_stable_links(self):
        item_rows = [
            {
                "itemid": "100",
                "internalname": "ExampleSword",
                "name": "Example Sword",
                "type": "Weapon",
                "damage": "20",
                "damagetype": "melee",
                "melee": "1",
                "hardmode": "No",
            },
            {
                "itemid": "22",
                "internalname": "IronBar",
                "name": "Iron Bar",
                "type": "Crafting material",
            },
        ]
        recipe_rows = [
            {
                "page_title": "Recipes/Anvil/register",
                "result": "Example Sword",
                "resultid": "100",
                "amount": "1",
                "station": "Iron Anvil",
                "version": "",
                "ings": "¦Iron Bar¦10",
                "args": "Iron Bar¦10",
            }
        ]
        items, recipes, ingredients = build_catalog(item_rows, recipe_rows)
        by_key = {item["item_key"]: item for item in items}
        self.assertIn("terraria_100", by_key)
        self.assertIn("terraria_22", by_key)
        self.assertEqual(by_key["terraria_22"]["primary_category"], "material")
        self.assertEqual(len(recipes), 1)
        self.assertEqual(recipes[0]["result_item_key"], "terraria_100")
        self.assertEqual(ingredients[0]["linked_item_key"], "terraria_22")
        self.assertEqual(ingredients[0]["quantity"], 10)


class SupabaseAuthHeaderTests(unittest.TestCase):
    def test_new_secret_key_is_only_sent_as_apikey(self):
        headers = supabase_headers("sb_secret_example", {"Prefer": "return=minimal"})
        self.assertEqual(headers["apikey"], "sb_secret_example")
        self.assertNotIn("Authorization", headers)
        self.assertEqual(headers["Prefer"], "return=minimal")

    def test_legacy_service_role_jwt_uses_bearer_auth(self):
        headers = supabase_headers("eyJlegacy.jwt.key")
        self.assertEqual(headers["apikey"], "eyJlegacy.jwt.key")
        self.assertEqual(headers["Authorization"], "Bearer eyJlegacy.jwt.key")


if __name__ == "__main__":
    unittest.main()
