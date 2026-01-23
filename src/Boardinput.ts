// board.enableMoveInput((event) => {
//   switch (event.type) {
//     case INPUT_EVENT_TYPE.moveInputStarted:
//       const pieceColor = event.piece.charAt(0);
//       return game.turn() === pieceColor;

//     case INPUT_EVENT_TYPE.validateMoveInput:
//       const isPromotion =
//         event.piece.charAt(1) === "p" &&
//         ((event.squareTo.charAt(1) === "8" && game.turn() === "w") ||
//           (event.squareTo.charAt(1) === "1" && game.turn() === "b"));

//       if (isPromotion) {
//         board.showPromotionDialog(event.squareTo, game.turn(), (result) => {
//           if (result && result.piece) {
//             const move = game.move({
//               from: event.squareFrom,
//               to: event.squareTo,
//               promotion: result.piece.charAt(1),
//             });
//             if (move) {
//               board.setPosition(game.fen(), true);
//               updateEngine();
//             }
//           } else {
//             board.setPosition(game.fen(), true);
//           }
//         });
//         return true;
//       }

//       try {
//         const move = game.move({
//           from: event.squareFrom,
//           to: event.squareTo,
//         });
//         if (move) {
//           game.undo();
//           return true;
//         }
//       } catch (e) {
//         return false;
//       }
//       return false;

//     case INPUT_EVENT_TYPE.moveInputFinished:
//       if (event.legalMove) {
//         board.removeMarkers();
//         board.removeArrows();
//         game.move({
//           from: event.squareFrom,
//           to: event.squareTo,
//         });

//         board.setPosition(game.fen(), true);
//         updateEngine();
//       }
//       break;
//   }
// });
