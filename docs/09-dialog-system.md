# Dialog System

## Overview

Growtopia uses a custom markup language for all UI dialogs — registration forms, item info, lock settings, vending machines, etc. The server sends dialog markup as a string via the `OnDialogRequest` variant, and the client renders it as a popup.

## Sending a Dialog

```
Variant[0] = "OnDialogRequest"
Variant[1] = dialog_markup_string
```

## Markup Elements

Each line is one UI element. Format: `element_type|param1|param2|...\n`

All element signatures below were extracted from the `create_dialog` builder in
Gurotopia (`include/tools/create_dialog.cpp`) — every retail/private GTPS uses
the same wire format.

### Labels and Text

```
add_label|size|text|left
add_label_with_icon|size|text|left|item_id|
add_label_with_ele_icon|size|text|left|item_id|element_id|
add_textbox|text|left|
add_smalltext|text|left|
```

- `size` controls font size — `big` or `small`
- The trailing `left` token is the alignment (Growtopia only renders `left` in practice)
- `item_id` shows that item's icon next to the label
- `element_id` (ele_icon variant) layers an element overlay (fire, water, etc.) on the icon

### Input Fields

```
add_text_input|field_id|Label:|default_value|max_length|
add_text_input_password|field_id|Password:||30|
```

- `field_id` is the key returned in `dialog_return`
- `default_value` is shown pre-filled (use `""` for empty)
- `max_length` limits character input

### Buttons

```
add_button|button_id|Button Text|noflags|0|0|
add_button_with_icon|button_id|Button Text|staticBlueFrame|item_id|
add_image_button|button_id|image_path|layout|link|
add_custom_button|button_id|image_path|
add_small_font_button|button_id|Button Text|noflags|0|0|
```

- `noflags` = normal button. Other style flags exist (`staticBlueFrame`,
  `bigBlueButton`, etc.) but `noflags` is the safe default.
- `add_image_button` and `add_custom_button` render arbitrary RTTEX images — useful for store skins.
- `add_small_font_button` is identical to `add_button` but uses the smaller font face.

### Checkboxes

```
add_checkbox|check_id|Label text|0|
```

- Last param: `0` = unchecked, `1` = checked by default

### Item Picker

```
add_item_picker|picker_id|Label|Selection prompt|
```

Opens the player's inventory to pick an item. Returns the selected item's ID under `picker_id` in `dialog_return`.

### Spacers and Layout

```
add_spacer|small|
add_spacer|big|
add_layout_spacer|layout_name|
add_custom_break|
add_custom_margin|x:NN;y:NN|
set_custom_spacing|x:NN;y:NN|
```

`add_custom_break`, `add_custom_margin` and `set_custom_spacing` give pixel-precise layout control — used for fancy registration screens, store skins, and the gazette.

### Embedded Data (Hidden)

```
embed_data|key|value
```

Not visible to the player. Sent back in `dialog_return` for server-side context (e.g. the tile coords or item ID a dialog is bound to).

### Player Info & Achievements

```
add_player_info|label|progress_bar_name|progress|total_progress|
add_progress_bar|label|size|progress_label|current|total|color|
add_achieve|||left|count|
```

- `add_player_info` shows a name+level header above a progress bar.
- `add_progress_bar` is the standalone XP-style bar used in Punish/View dialogs.
- `add_achieve` displays the player's achievement count.

### Popup Header

```
add_popup_name|name|
```

Used by some retail dialogs (Surgery!, Pick a Flag) to display a banner instead of a label.

### Dialog End

```
end_dialog|dialog_name|cancel_button_label|submit_button_label|
add_quick_exit|
```

- `dialog_name` is returned in the `dialog_return` action so the server knows which dialog was submitted.
- The two trailing labels become the Cancel and OK buttons. Empty strings hide them; the defaults are `Cancel` and `OK`.
- `add_quick_exit` adds an X close button at the top — fires `dialog_return` with no payload (or doesn't fire at all on some builds).

### Color and Default Style

```
set_default_color|`o
```

Sets the default text color for subsequent elements. Use any color escape (see below).

## Color Codes

Used in dialog text, chat, player names — anywhere text is displayed:

```
`0  White         `1  Cyan          `2  Green
`3  Light Blue    `4  Red           `5  Purple
`6  Gold/Yellow   `7  Gray          `8  Orange
`9  Yellow        `a  Pale Yellow   `b  Pale Green
`c  Pink          `d  Lavender      `e  Beige
`q  Teal          `w  White (bold)  `o  Reset/Default
`p  Rainbow (animated)               ``  Literal backtick
```

Special `@` prefix used in some retail strings (e.g. `` `@Valentine's `` ) renders the same as Gold but with a warm yellow tint depending on theme.

## Dialog Return

When the player submits a dialog, the client sends a `GAME_MESSAGE` (type 3):

```
action|dialog_return
dialog_name|the_name_from_end_dialog
tilex|X
tiley|Y
field_id|user_input_value
check_id|1
picker_id|selected_item_id
buttonClicked|which_button_was_pressed
```

- `tilex`/`tiley`: the tile that was wrenched to open this dialog (-1 if not tile-based)
- Each input field returns its `field_id` with the user's value
- Checkboxes return `1` if checked (absent if unchecked)
- `buttonClicked` tells you which button triggered the submit; `__close__` for the X / cancel button on some builds

## Example: Registration Dialog

```
set_default_color|`o
add_label_with_icon|big|`wCreate Account|left|206|
add_spacer|small|
add_textbox|Choose a GrowID. This will be your username.|left|
add_text_input|growid|GrowID:||18|
add_text_input_password|password|Password:||30|
add_text_input_password|verify|Verify Password:||30|
add_spacer|small|
add_textbox|By creating an account you agree to the rules.|left|
end_dialog|registration|Cancel|Create!|
add_quick_exit|
```

## Example: Lock Settings Dialog

```
set_default_color|`o
add_label_with_icon|big|`wWorld Lock|left|242|
add_spacer|small|
add_checkbox|checkbox_public|Allow anyone to Build and Break|0|
add_checkbox|checkbox_disable_music|Disable Custom Music Blocks|0|
add_text_input|minimum_entry_level|Minimum Entry Level:|0|3|
add_spacer|small|
add_button|recalculate|Re-apply lock|noflags|0|0|
end_dialog|lock_edit|Cancel|OK|
add_quick_exit|
embed_data|tilex|50
embed_data|tiley|24
```
